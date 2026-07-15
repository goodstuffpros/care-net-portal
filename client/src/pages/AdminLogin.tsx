import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

const ADMIN_SESSION_KEY = "cnp_admin_token";

export function getAdminToken() {
  return localStorage.getItem(ADMIN_SESSION_KEY);
}

export function setAdminToken(token: string) {
  localStorage.setItem(ADMIN_SESSION_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
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
      const res = await apiRequest("POST", "/api/auth/admin-login", { email, password });
      const data = await res.json();
      if (!res.ok) return setError(data.message ?? "Invalid credentials");
      setAdminToken(data.token);
      onSuccess();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-600 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 3C8 3 5 6 5 10c0 5 7 11 7 11s7-6 7-11c0-4-3-7-7-7zm0 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="white"/>
            </svg>
          </div>
          <h1 className="text-white font-bold text-xl">Admin Office</h1>
          <p className="text-white/40 text-sm mt-1">Care Net Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30"
              placeholder="your@email.com"
              required
            />
          </div>
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            {loading ? "Signing in…" : "Sign In to Admin Office"}
          </button>
        </form>
      </div>
    </div>
  );
}
