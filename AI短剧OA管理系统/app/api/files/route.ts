import { env } from "cloudflare:workers";
import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { ApiError, cleanText, errorResponse } from "@/server/http";
import { requirePermission } from "@/server/policy";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function getFilesBucket(): R2Bucket | null {
  return ((env as unknown as { FILES?: R2Bucket }).FILES ?? null);
}

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "file.read");
    const result = account.role === "super_admin" || account.role === "market"
      ? await getD1().prepare(`SELECT id, uploader_account_id, original_name, storage_key, mime_type, size, checksum, storage_backend, status, created_at FROM file_assets WHERE status = 'active' ORDER BY created_at DESC LIMIT 200`).all()
      : await getD1().prepare(`SELECT id, uploader_account_id, original_name, storage_key, mime_type, size, checksum, storage_backend, status, created_at FROM file_assets WHERE uploader_account_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 200`).bind(account.id).all();
    return Response.json({ files: result.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "file.write");
    const form = await request.formData();
    const value = form.get("file");
    if (!(value instanceof File)) throw new ApiError(400, "file is required");
    if (value.size <= 0 || value.size > MAX_FILE_SIZE) throw new ApiError(400, "file size must be between 1 byte and 5 MB");
    const originalName = cleanText(value.name, 255) || "upload.bin";
    const mimeType = cleanText(value.type, 120) || "application/octet-stream";
    const buffer = await value.arrayBuffer();
    const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)))
      .map((item) => item.toString(16).padStart(2, "0")).join("");
    const id = crypto.randomUUID();
    const storageKey = `${account.id}/${id}-${originalName.replace(/[^A-Za-z0-9._-]/g, "_")}`;
    const bucket = getFilesBucket();
    let storageBackend = "d1";
    if (bucket) {
      await bucket.put(storageKey, buffer, { httpMetadata: { contentType: mimeType } });
      storageBackend = "r2";
    }
    await getD1().prepare(`
      INSERT INTO file_assets (id, uploader_account_id, original_name, storage_key, mime_type, size, checksum, storage_backend, content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, account.id, originalName, storageKey, mimeType, value.size, checksum, storageBackend, bucket ? null : buffer).run();
    await writeAudit(account.id, "file.upload", "file", id, { originalName, size: value.size, storageBackend });
    return Response.json({ file: { id, originalName, mimeType, size: value.size, checksum, storageBackend } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}