import { env } from "cloudflare:workers";
import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { ApiError, errorResponse } from "@/server/http";
import { requirePermission } from "@/server/policy";

function getFilesBucket(): R2Bucket | null {
  return ((env as unknown as { FILES?: R2Bucket }).FILES ?? null);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "file.read");
    const { id } = await context.params;
    const row = await getD1().prepare("SELECT * FROM file_assets WHERE id = ? AND status = 'active' LIMIT 1").bind(id).first<{
      id: string; uploader_account_id: string; original_name: string; storage_key: string; mime_type: string;
      size: number; storage_backend: string; content: ArrayBuffer | null;
    }>();
    if (!row) throw new ApiError(404, "File not found");
    if (account.role !== "super_admin" && account.role !== "market" && row.uploader_account_id !== account.id) throw new ApiError(403, "Forbidden");
    let body: BodyInit | null = row.content;
    if (row.storage_backend === "r2") {
      const object = await getFilesBucket()?.get(row.storage_key);
      if (!object) throw new ApiError(404, "File content not found");
      body = object.body;
    }
    return new Response(body, {
      headers: {
        "Content-Type": row.mime_type,
        "Content-Length": String(row.size),
        "Content-Disposition": `attachment; filename="${row.original_name.replace(/"/g, "")}"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "file.write");
    const { id } = await context.params;
    const row = await getD1().prepare("SELECT uploader_account_id, storage_key, storage_backend FROM file_assets WHERE id = ? AND status = 'active' LIMIT 1")
      .bind(id).first<{ uploader_account_id: string; storage_key: string; storage_backend: string }>();
    if (!row) throw new ApiError(404, "File not found");
    if (account.role !== "super_admin" && account.role !== "market" && row.uploader_account_id !== account.id) throw new ApiError(403, "Forbidden");
    if (row.storage_backend === "r2") await getFilesBucket()?.delete(row.storage_key);
    await getD1().prepare("UPDATE file_assets SET status = 'deleted' WHERE id = ?").bind(id).run();
    await writeAudit(account.id, "file.delete", "file", id);
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}