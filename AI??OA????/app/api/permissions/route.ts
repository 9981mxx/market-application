import { requireAccount } from "@/server/auth";
import { getD1 } from "@/server/database";
import { errorResponse } from "@/server/http";
import { allowedInviteTargets } from "@/server/policy";
import { INVITE_ROLE_LABELS } from "@/server/types";

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    const result = await getD1().prepare("SELECT permission FROM role_permissions WHERE role = ? ORDER BY permission")
      .bind(account.role)
      .all<{ permission: string }>();
    return Response.json({
      role: account.role,
      roleLabel: account.roleLabel,
      permissions: result.results.map((row) => row.permission),
      inviteTargets: allowedInviteTargets(account.role).map((role) => ({ role, label: INVITE_ROLE_LABELS[role] })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}