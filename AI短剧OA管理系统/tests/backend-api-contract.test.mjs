import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (file) => readFile(new URL(file, root), "utf8");

test("uses one frontend API client for authenticated backend modules", async () => {
  const [client, page, operations] = await Promise.all([
    source("app/lib/api.ts"),
    source("app/page.tsx"),
    source("app/components/backend/BackendOperations.tsx"),
  ]);

  assert.match(client, /credentials: "same-origin"/);
  assert.match(client, /apiBlob/);
  for (const endpoint of ["approvals", "notifications", "audit-logs", "reports/overview", "files", "config", "backups"]) {
    assert.match(client, new RegExp(`/api/${endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
  assert.match(page, /backendApi\.approvals\.list/);
  assert.match(page, /backendApi\.notifications\.list/);
  assert.match(page, /apiBlob\(item\.qr_url\)/);
  assert.match(operations, /backendApi\.reports\.overview/);
  assert.match(operations, /backendApi\.files\.upload/);
  assert.match(operations, /backendApi\.config\.save/);
  assert.match(operations, /backendApi\.backups\.create/);
});

test("keeps logout visible and renders the brand without an optimized image route", async () => {
  const [page, register, brand, styles] = await Promise.all([
    source("app/page.tsx"),
    source("app/register/page.tsx"),
    source("app/components/BrandSignature.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(page, /\/api\/auth\/logout/);
  assert.match(page, /className="logoutButton"/);
  assert.match(page, /退出登录/);
  assert.match(page, /<BrandSignature compact \/>/);
  assert.match(register, /<BrandSignature subtitle="AI 短剧教育 OA" \/>/);
  assert.doesNotMatch(page, /leopard-speed-logo\.png/);
  assert.doesNotMatch(register, /leopard-speed-logo\.png/);
  assert.match(brand, /className="brandEmblem"/);
  assert.match(styles, /\.oaSidebar nav\{flex:1;min-height:0;overflow-y:auto/);
  assert.match(styles, /\.logoutButton\{/);
});
