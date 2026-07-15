import { useState } from "react";

export const ADMIN_TOKEN_KEY = "cnp_admin_token";

export function getAdminToken(): string | null {
  try { return localStorage.getItem(ADMIN_TOKEN_KEY); } catch { return null; }
}
export function setAdminToken(token: string) {
  try { localStorage.setItem(ADMIN_TOKEN_KEY, token); } catch {}
}
export function clearAdminToken() {
  try { localStorage.removeItem(ADMIN_TOKEN_KEY); } catch {}
}

export default function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Invalid credentials");
        return;
      }
      setAdminToken(data.token);
      onSuccess();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: 14, background: "#0d9488", marginBottom: 16 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
            </svg>
          </div>
          <div style={{ color: "#ffffff", fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Admin Office</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Care Net Portal</div>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, display: "block", marginBottom: 6 }}>Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 16px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, display: "block", marginBottom: 6 }}>Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 16px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {error && (
            <div style={{ color: "#f87171", fontSize: 13, textAlign: "center" }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ background: loading ? "#0f766e" : "#0d9488", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Signing in…" : "Sign In to Admin Office"}
          </button>
        </form>
      </div>
    </div>
  );
}
