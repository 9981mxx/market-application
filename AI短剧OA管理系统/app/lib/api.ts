export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !(value instanceof FormData) && !(value instanceof Blob);
}

async function responseMessage(response: Response): Promise<string> {
  const fallback = response.status === 401
    ? "登录状态已失效，请重新登录"
    : response.status === 403 ? "当前账号没有操作权限" : "请求失败，请稍后重试";
  try {
    const payload = await response.clone().json() as { error?: string; message?: string };
    return payload.message || payload.error || fallback;
  } catch {
    const text = await response.text().catch(() => "");
    return text || fallback;
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  let body = options.body;
  if (isPlainObject(body)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }
  const response = await fetch(path, { ...options, body, headers, credentials: "same-origin" });
  if (!response.ok) throw new ApiClientError(await responseMessage(response), response.status);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  const response = await fetch(path, { ...options, credentials: "same-origin" });
  if (!response.ok) throw new ApiClientError(await responseMessage(response), response.status);
  return response.blob();
}

export const backendApi = {
  approvals: {
    list: (status = "pending") => apiRequest<{ approvals: Record<string, unknown>[] }>(`/api/approvals?status=${encodeURIComponent(status)}`),
    decide: (id: string, status: "approved" | "rejected", reviewNote = "") => apiRequest<{ success: true }>(`/api/approvals/${id}`, { method: "PATCH", body: { status, reviewNote } }),
  },
  notifications: {
    list: () => apiRequest<{ notifications: Record<string, unknown>[]; unreadCount: number }>("/api/notifications"),
    read: (id: string) => apiRequest<{ success: true }>(`/api/notifications/${id}`, { method: "PATCH" }),
    readAll: () => apiRequest<{ success: true }>("/api/notifications", { method: "PATCH", body: { action: "read_all" } }),
  },
  auditLogs: () => apiRequest<{ logs: Record<string, unknown>[] }>("/api/audit-logs?limit=100"),
  reports: {
    overview: () => apiRequest<Record<string, number>>("/api/reports/overview"),
    channels: () => apiRequest<{ channels: Record<string, unknown>[] }>("/api/reports/channels"),
    recharges: () => apiRequest<{ recharges: Record<string, unknown>[] }>("/api/reports/recharges"),
  },
  files: {
    list: () => apiRequest<{ files: Record<string, unknown>[] }>("/api/files"),
    upload: (file: File) => {
      const form = new FormData();
      form.set("file", file);
      return apiRequest<{ file: Record<string, unknown> }>("/api/files", { method: "POST", body: form });
    },
    remove: (id: string) => apiRequest<{ success: true }>(`/api/files/${id}`, { method: "DELETE" }),
  },
  config: {
    list: () => apiRequest<{ configs: Record<string, unknown>[] }>("/api/config"),
    save: (configs: Record<string, unknown>[]) => apiRequest<{ success: true }>("/api/config", { method: "PATCH", body: { configs } }),
  },
  backups: {
    list: () => apiRequest<{ backups: Record<string, unknown>[] }>("/api/backups"),
    create: () => apiRequest<{ backup: Record<string, unknown> }>("/api/backups", { method: "POST" }),
  },
};
