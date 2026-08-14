import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { errorResponse } from "@/server/http";
import { requirePermission } from "@/server/policy";

const BACKUP_TABLES = [
  "roles", "role_permissions", "accounts", "channels", "end_users", "invitations", "invitation_bindings",
  "audit_logs", "withdrawal_requests", "notifications", "file_assets", "system_configs",
];

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "backup.read");
    const result = await getD1().prepare(`
      SELECT id, created_by, status, table_count, record_count, created_at, completed_at
      FROM backup_runs ORDER BY created_at DESC LIMIT 50
    `).all();
    return Response.json({ backups: result.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "backup.write");
    const db = getD1();
    const snapshot: Record<string, unknown[]> = {};
    let recordCount = 0;
    for (const table of BACKUP_TABLES) {
      const query = table === "file_assets"
        ? "SELECT id, uploader_account_id, original_name, storage_key, mime_type, size, checksum, storage_backend, status, created_at FROM file_assets"
        : `SELECT * FROM ${table}`;
      const result = await db.prepare(query).all();
      snapshot[table] = result.results;
      recordCount += result.results.length;
    }
    const id = crypto.randomUUID();
    const encoded = JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), tables: snapshot });
    await db.prepare(`
      INSERT INTO backup_runs (id, created_by, status, table_count, record_count, snapshot, completed_at)
      VALUES (?, ?, 'completed', ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(id, account.id, BACKUP_TABLES.length, recordCount, encoded).run();
    await writeAudit(account.id, "backup.create", "backup", id, { tableCount: BACKUP_TABLES.length, recordCount });
    return Response.json({ backup: { id, status: "completed", tableCount: BACKUP_TABLES.length, recordCount } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}