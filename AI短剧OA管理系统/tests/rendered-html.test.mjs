import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const businessDocument = new URL("../../项目文档.md", import.meta.url);
const technicalDocument = new URL("../../技术文档.md", import.meta.url);

const apiRoutes = [
  "app/api/auth/login/route.ts",
  "app/api/auth/logout/route.ts",
  "app/api/auth/me/route.ts",
  "app/api/permissions/route.ts",
  "app/api/channels/route.ts",
  "app/api/channels/[id]/route.ts",
  "app/api/users/route.ts",
  "app/api/users/[id]/route.ts",
  "app/api/invitations/route.ts",
  "app/api/invitations/[id]/route.ts",
  "app/api/invitations/[id]/qrcode/route.ts",
  "app/api/public/invitations/[code]/route.ts",
  "app/api/public/register/route.ts",
  "app/api/withdrawals/route.ts",
  "app/api/withdrawals/[id]/route.ts",
  "app/api/approvals/route.ts",
  "app/api/approvals/[id]/route.ts",
  "app/api/notifications/route.ts",
  "app/api/notifications/[id]/route.ts",
  "app/api/audit-logs/route.ts",
  "app/api/files/route.ts",
  "app/api/files/[id]/route.ts",
  "app/api/reports/overview/route.ts",
  "app/api/reports/channels/route.ts",
  "app/api/reports/recharges/route.ts",
  "app/api/config/route.ts",
  "app/api/backups/route.ts",
  "app/api/backups/[id]/route.ts",
];

function projectFile(path) {
  return new URL(path, root);
}

test("contains the backend module 1-5 route surface", async () => {
  await Promise.all(apiRoutes.map((route) => access(projectFile(route))));

  const [login, channels, users, invitations, publicRegister] = await Promise.all([
    readFile(projectFile("app/api/auth/login/route.ts"), "utf8"),
    readFile(projectFile("app/api/channels/route.ts"), "utf8"),
    readFile(projectFile("app/api/users/route.ts"), "utf8"),
    readFile(projectFile("app/api/invitations/route.ts"), "utf8"),
    readFile(projectFile("app/api/public/register/route.ts"), "utf8"),
  ]);

  assert.match(login, /loginAccount/);
  assert.match(channels, /requirePermission\(account, "channel\.write"\)/);
  assert.doesNotMatch(channels, /SELECT[^;]*parent_channel_id[^;]*FROM channels c/is);
  assert.match(users, /accessibleChannelIds/);
  assert.match(invitations, /allowedInviteTargets/);
  assert.match(publicRegister, /invitation_bindings/);
});

test("defines the persistent data and authentication safeguards", async () => {
  const [schema, security, auth, policy, hosting] = await Promise.all([
    readFile(projectFile("db/schema.ts"), "utf8"),
    readFile(projectFile("server/security.ts"), "utf8"),
    readFile(projectFile("server/auth.ts"), "utf8"),
    readFile(projectFile("server/policy.ts"), "utf8"),
    readFile(projectFile(".openai/hosting.json"), "utf8"),
  ]);

  const tables = [...schema.matchAll(/sqliteTable\("([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(tables.sort(), [
    "accounts",
    "audit_logs",
    "backup_runs",
    "channels",
    "end_users",
    "file_assets",
    "invitation_bindings",
    "invitations",
    "notifications",
    "role_permissions",
    "roles",
    "sessions",
    "system_configs",
    "withdrawal_requests",
  ]);
  assert.match(security, /PBKDF2_ITERATIONS = 120_000/);
  assert.match(security, /SHA-256/);
  assert.match(auth, /HttpOnly; SameSite=Lax/);
  assert.match(auth, /SESSION_MAX_AGE_SECONDS = 60 \* 60 \* 24 \* 7/);
  assert.match(policy, /WITH RECURSIVE channel_scope/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});

test("connects the management and invitation pages to real APIs", async () => {
  const [page, register, packageJson] = await Promise.all([
    readFile(projectFile("app/page.tsx"), "utf8"),
    readFile(projectFile("app/register/page.tsx"), "utf8"),
    readFile(projectFile("package.json"), "utf8"),
  ]);

  assert.match(page, /apiRequest[^\n]*"\/api\/auth\/login"/);
  assert.match(page, /apiRequest[^\n]*"\/api\/channels"/);
  assert.match(page, /apiRequest[^\n]*"\/api\/users"/);
  assert.match(page, /apiRequest[^\n]*"\/api\/invitations"/);
  assert.match(page, /登录用户名/);
  assert.match(page, /登录手机号/);
  assert.match(register, /\/api\/public\/register/);
  assert.match(register, /邀请登记/);

  const packageData = JSON.parse(packageJson);
  assert.match(packageData.scripts.dev, /^cross-env /);
  assert.equal(packageData.scripts.typecheck, "tsc --noEmit");
  assert.equal(packageData.dependencies.qrcode, "^1.5.4");
});

test("archives the business and technical updates separately", async () => {
  const [business, technical] = await Promise.all([
    readFile(businessDocument, "utf8"),
    readFile(technicalDocument, "utf8"),
  ]);

  assert.match(business, /2026-08-14 后端模块 1—5 业务落地/);
  assert.match(business, /v4 后端基础版/);
  assert.match(business, /永久邀请归属/);
  assert.doesNotMatch(business, /PBKDF2|PreparedStatement|npm run typecheck/);

  assert.match(technical, /2026-08-14 后端模块 1—5 技术栈/);
  assert.match(technical, /2026-08-14 v4/);
  assert.match(technical, /PBKDF2-SHA256/);
  assert.match(technical, /D1 PreparedStatement/);
});
