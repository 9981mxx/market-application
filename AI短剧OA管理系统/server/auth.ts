import { ensureDatabase, getD1, writeAudit } from "./database";
import { ApiError } from "./http";
import { randomToken, sha256, verifyPassword } from "./security";
import { LABEL_TO_ROLE, ROLE_LABELS, ROLES, type AuthAccount, type Role } from "./types";

const SESSION_COOKIE = "ls_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type AccountRow = {
  id: string;
  username: string;
  phone: string | null;
  password_hash: string;
  role: Role;
  display_name: string;
  status: string;
  channel_id: string | null;
};

function parseCookies(value: string | null): Record<string, string> {
  if (!value) return {};
  return Object.fromEntries(value.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return [part.trim(), ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
}

function toAccount(row: AccountRow): AuthAccount {
  return {
    id: row.id,
    username: row.username,
    phone: row.phone,
    displayName: row.display_name,
    role: row.role,
    roleLabel: ROLE_LABELS[row.role],
    status: row.status,
    channelId: row.channel_id,
  };
}

export function sessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function clearedSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export async function loginAccount(
  identifier: string,
  password: string,
  roleLabel: string,
  request: Request,
): Promise<{ account: AuthAccount; token: string }> {
  await ensureDatabase();
  const role = LABEL_TO_ROLE[roleLabel] ?? (ROLES.includes(roleLabel as Role) ? roleLabel as Role : undefined);
  if (!role) throw new ApiError(400, "请选择有效角色");
  const db = getD1();
  const row = await db.prepare(
    "SELECT id, username, phone, password_hash, role, display_name, status, channel_id FROM accounts WHERE (username = ? OR phone = ?) LIMIT 1",
  ).bind(identifier, identifier).first<AccountRow>();
  if (!row || row.role !== role || !(await verifyPassword(password, row.password_hash))) {
    throw new ApiError(401, "账号、密码或角色不匹配");
  }
  if (row.status !== "active") throw new ApiError(403, "账号当前不可用，请联系管理员");

  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "local";
  await db.prepare("INSERT INTO sessions (id, account_id, token_hash, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), row.id, tokenHash, expiresAt, ip, request.headers.get("user-agent") ?? "")
    .run();
  await writeAudit(row.id, "auth.login", "account", row.id, { role });
  return { account: toAccount(row), token };
}

export async function getOptionalAccount(request: Request): Promise<AuthAccount | null> {
  await ensureDatabase();
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await getD1().prepare(`
    SELECT a.id, a.username, a.phone, a.password_hash, a.role, a.display_name, a.status, a.channel_id
    FROM sessions s
    JOIN accounts a ON a.id = s.account_id
    WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `).bind(tokenHash).first<AccountRow>();
  if (!row || row.status !== "active") return null;
  return toAccount(row);
}

export async function requireAccount(request: Request): Promise<AuthAccount> {
  const account = await getOptionalAccount(request);
  if (!account) throw new ApiError(401, "登录状态已失效，请重新登录");
  return account;
}

export async function logoutAccount(request: Request): Promise<void> {
  await ensureDatabase();
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (!token) return;
  const tokenHash = await sha256(token);
  const session = await getD1().prepare("SELECT account_id FROM sessions WHERE token_hash = ? LIMIT 1").bind(tokenHash).first<{ account_id: string }>();
  await getD1().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  if (session) await writeAudit(session.account_id, "auth.logout", "account", session.account_id);
}