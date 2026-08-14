import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { ApiError, cleanText, errorResponse, readJson, requireText } from "@/server/http";
import { requirePermission } from "@/server/policy";

function parseValue(value: string, type: string): unknown {
  if (type === "number") return Number(value);
  if (type === "boolean") return value === "true";
  if (type === "json") {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "config.read");
    const result = await getD1().prepare("SELECT config_key, config_value, value_type, description, updated_by, updated_at FROM system_configs ORDER BY config_key")
      .all<{ config_key: string; config_value: string; value_type: string; description: string; updated_by: string | null; updated_at: string }>();
    return Response.json({ configs: result.results.map((row) => ({ ...row, value: parseValue(row.config_value, row.value_type) })) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "config.write");
    const payload = await readJson<Record<string, unknown>>(request);
    const items = Array.isArray(payload.configs) ? payload.configs : [payload];
    const statements: D1PreparedStatement[] = [];
    const changed: string[] = [];
    for (const item of items) {
      if (!item || typeof item !== "object") throw new ApiError(400, "Invalid config item");
      const value = item as Record<string, unknown>;
      const key = requireText(value.key ?? value.configKey, "config key", 120);
      if (!/^[A-Za-z0-9_.-]+$/.test(key)) throw new ApiError(400, "Invalid config key");
      const raw = value.value;
      if (raw === undefined) throw new ApiError(400, "config value is required");
      const type = cleanText(value.valueType, 20) || (typeof raw === "number" ? "number" : typeof raw === "boolean" ? "boolean" : "string");
      const encoded = type === "json" ? JSON.stringify(raw) : String(raw);
      const description = cleanText(value.description, 255);
      statements.push(getD1().prepare(`
        INSERT INTO system_configs (config_key, config_value, value_type, description, updated_by, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, value_type = excluded.value_type,
          description = excluded.description, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP
      `).bind(key, encoded, type, description, account.id));
      changed.push(key);
    }
    if (statements.length) await getD1().batch(statements);
    await writeAudit(account.id, "config.update", "system_config", null, { keys: changed });
    return Response.json({ success: true, keys: changed });
  } catch (error) {
    return errorResponse(error);
  }
}