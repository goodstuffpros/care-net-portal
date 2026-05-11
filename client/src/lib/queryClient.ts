import { QueryClient, QueryFunction } from "@tanstack/react-query";

export const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// Static assets (images, audio) must always come from Railway — never relative paths,
// because the Perplexity preview is a static S3 host with no Express to serve them.
export const STATIC_BASE = "https://care-net-portal-production.up.railway.app";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const TOKEN_KEY = "cn_auth_token";

export function setAuthToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}
export function getAuthToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function clearAuthToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers = authHeaders(data ? { "Content-Type": "application/json" } : {});
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // keep cookie as fallback
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
