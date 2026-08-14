export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "服务器处理失败，请稍后重试" }, { status: 500 });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, "请求数据格式不正确");
  }
}

export function cleanText(value: unknown, maxLength = 120): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function requireText(value: unknown, field: string, maxLength = 120): string {
  const result = cleanText(value, maxLength);
  if (!result) throw new ApiError(400, `请填写${field}`);
  return result;
}