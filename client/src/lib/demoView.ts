/**
 * View-only demo (/#/demo).
 *
 * The demo pass is kept ONLY in this browser tab (sessionStorage), never in
 * localStorage, and requests in demo mode never send cookies. That way a real
 * user (e.g. Becky) can open the demo on her own phone without being signed out
 * of her own portal: closing the tab or tapping Exit puts her right back.
 *
 * In demo mode every change (POST/PUT/PATCH/DELETE) is stopped here before it
 * leaves the phone, and the server refuses it too.
 */
export const DEMO_VIEW_KEY = "cn_demo_view_token";
export const DEMO_READONLY_EVENT = "cnp-demo-readonly";
export const DEMO_READONLY_MESSAGE = "This is a view-only demo. Nothing was saved.";
export const SIGNUP_URL = "/#/apply";

export function getDemoViewToken(): string | null {
  try { return sessionStorage.getItem(DEMO_VIEW_KEY); } catch { return null; }
}
export function isDemoView(): boolean {
  return !!getDemoViewToken();
}
export function setDemoViewToken(token: string) {
  try { sessionStorage.setItem(DEMO_VIEW_KEY, token); } catch {}
}
export function clearDemoViewToken() {
  try { sessionStorage.removeItem(DEMO_VIEW_KEY); } catch {}
}
/** Leave the demo and land on `to` (default: the person's own app, or sign-in). */
export function leaveDemoView(to: string = "/") {
  clearDemoViewToken();
  window.location.replace("/#" + to);
  window.location.reload();
}
export function notifyDemoReadonly() {
  try { window.dispatchEvent(new CustomEvent(DEMO_READONLY_EVENT)); } catch {}
}

const READ = new Set(["GET", "HEAD", "OPTIONS"]);
const ALLOW_WRITE = [/\/api\/auth\/logout$/, /\/api\/demo\/view$/];

function isApiUrl(url: string): boolean {
  if (url.startsWith("/api/")) return true;
  try {
    const u = new URL(url, window.location.href);
    return u.pathname.startsWith("/api/") && (u.origin === window.location.origin || /carenetportal\.com$|railway\.app$/.test(u.hostname));
  } catch { return false; }
}

let installed = false;
/** Call once at startup. Does nothing unless this tab is in the demo. */
export function installDemoViewGuard() {
  if (installed || typeof window === "undefined" || !isDemoView()) return;
  installed = true;
  const orig = window.fetch.bind(window);
  let renewing = false;
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!isApiUrl(url)) return orig(input as any, init);
    const token = getDemoViewToken();
    if (!token) return orig(input as any, init);
    const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const path = (() => { try { return new URL(url, window.location.href).pathname; } catch { return url; } })();
    if (!READ.has(method) && !ALLOW_WRITE.some(r => r.test(path))) {
      notifyDemoReadonly();
      return Promise.resolve(new Response(JSON.stringify({ message: DEMO_READONLY_MESSAGE, demoView: true }), {
        status: 403, headers: { "Content-Type": "application/json" },
      }));
    }
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    headers.set("Authorization", `Bearer ${token}`);
    // credentials: "omit" — never send this phone's own sign-in cookie with demo requests
    return orig(input as any, { ...init, headers, credentials: "omit" }).then(res => {
      if (res.status === 401 && path === "/api/auth/me" && !renewing) {
        // Demo pass expired (after a few hours) — quietly get a fresh one.
        // Only the sign-in check counts; other 401s are normal app behavior.
        renewing = true;
        clearDemoViewToken();
        window.location.replace("/#/demo");
        window.location.reload();
      }
      return res;
    });
  };
}
