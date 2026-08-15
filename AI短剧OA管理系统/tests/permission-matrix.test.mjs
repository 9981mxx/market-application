import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (file) => readFile(new URL(file, root), "utf8");

test("locks menus and write actions to the intended role matrix", async () => {
  const [page, policy, seed, approval] = await Promise.all([
    source("app/page.tsx"),
    source("server/policy.ts"),
    source("server/database.ts"),
    source("app/api/approvals/[id]/route.ts"),
  ]);

  assert.match(page, /"加盟端":\[[^\]]*"佣金比例调整"[^\]]*"报表统计"[^\]]*"文件管理"[^\]]*"消息通知"/);
  assert.doesNotMatch(page, /"加盟端":\[[^\]]*"审批中心"/);
  assert.doesNotMatch(page, /"代理端":\[[^\]]*"佣金比例调整"/);
  assert.doesNotMatch(page, /"代理端":\[[^\]]*"审批中心"/);
  assert.match(seed, /market: \[[^\]]*"approval\.write"[^\]]*"config\.read"[^\]]*"backup\.read"/);
  assert.doesNotMatch(seed, /market: \[[^\]]*"config\.write"/);
  assert.doesNotMatch(seed, /market: \[[^\]]*"backup\.write"/);
  assert.match(seed, /super_admin: \[[^\]]*"config\.write"[^\]]*"backup\.write"/);
  assert.match(policy, /WITH RECURSIVE channel_scope/);
  assert.match(approval, /accessibleChannelIds\(account\)/);
  assert.match(approval, /无权审批该渠道的提现申请/);
});
