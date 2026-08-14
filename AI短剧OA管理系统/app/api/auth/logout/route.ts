import { clearedSessionCookie, logoutAccount } from "@/server/auth";
import { errorResponse } from "@/server/http";

export async function POST(request: Request) {
  try {
    await logoutAccount(request);
    return Response.json(
      { success: true },
      { headers: { "Set-Cookie": clearedSessionCookie(request) } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}