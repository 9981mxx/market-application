import { loginAccount, sessionCookie } from "@/server/auth";
import { errorResponse, readJson, requireText } from "@/server/http";

export async function POST(request: Request) {
  try {
    const payload = await readJson<{ identifier?: string; password?: string; role?: string }>(request);
    const identifier = requireText(payload.identifier, "用户名或手机号", 80);
    const password = requireText(payload.password, "密码", 128);
    const role = requireText(payload.role, "角色", 20);
    const result = await loginAccount(identifier, password, role, request);
    return Response.json(
      { account: result.account },
      { headers: { "Set-Cookie": sessionCookie(result.token, request) } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}