import { getOptionalAccount } from "@/server/auth";
import { errorResponse } from "@/server/http";

export async function GET(request: Request) {
  try {
    const account = await getOptionalAccount(request);
    return Response.json({ account });
  } catch (error) {
    return errorResponse(error);
  }
}