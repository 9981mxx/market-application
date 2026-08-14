import { requireAccount } from "@/server/auth";
import { getD1 } from "@/server/database";
import { ApiError, errorResponse } from "@/server/http";
import { requirePermission } from "@/server/policy";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "backup.read");
    const { id } = await context.params;
    const row = await getD1().prepare("SELECT id, created_by, status, table_count, record_count, snapshot, created_at, completed_at FROM backup_runs WHERE id = ? LIMIT 1")
      .bind(id).first<{ snapshot: string }>();
    if (!row) throw new ApiError(404, "Backup not found");
    let snapshot: unknown = row.snapshot;
    try { snapshot = JSON.parse(row.snapshot); } catch { /* keep raw snapshot for diagnostics */ }
    return Response.json({ backup: { ...row, snapshot } });
  } catch (error) {
    return errorResponse(error);
  }
}