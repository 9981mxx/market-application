import QRCode from "qrcode";
import { requireAccount } from "@/server/auth";
import { getD1 } from "@/server/database";
import { ApiError, errorResponse } from "@/server/http";
import { requirePermission } from "@/server/policy";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "invitation.read");
    const { id } = await context.params;
    const invitation = await getD1().prepare("SELECT code FROM invitations WHERE id = ? AND inviter_account_id = ? LIMIT 1")
      .bind(id, account.id).first<{ code: string }>();
    if (!invitation) throw new ApiError(404, "邀请码不存在");
    const url = new URL(`/register?invite=${encodeURIComponent(invitation.code)}`, request.url).toString();
    const svg = await QRCode.toString(url, {
      type: "svg",
      width: 360,
      margin: 2,
      color: { dark: "#13234f", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `inline; filename="invite-${invitation.code}.svg"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}