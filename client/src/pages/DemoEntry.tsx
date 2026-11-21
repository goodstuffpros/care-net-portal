/**
 * /#/demo — opens the sample family portal view-only, with no sign-in.
 * Gets a short-lived demo pass, keeps it in this tab only, then shows the app.
 */
import { useEffect, useState } from "react";
import { getDemoViewToken, setDemoViewToken } from "@/lib/demoView";

export default function DemoEntry() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function go() {
      if (!getDemoViewToken()) {
        try {
          const res = await fetch("/api/demo/view", { method: "POST", credentials: "omit" });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || !body.token) throw new Error(body.message || "The demo could not open.");
          setDemoViewToken(body.token);
        } catch (e: any) {
          if (!cancelled) setError(e?.message || "The demo could not open.");
          return;
        }
      }
      window.location.replace("/#/");
      window.location.reload();
    }
    go();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[#F7F6F2]">
      <div className="text-[#0C4E54] text-2xl font-semibold">Care Net Portal</div>
      {error ? (
        <>
          <p className="mt-4 text-[15px] text-[#1F2A2C]">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-[#01696F] text-white font-semibold px-6 py-3">Try again</button>
          <a href="https://www.carenetportal.com" className="mt-3 text-[#01696F] text-sm underline">Go to CareNetPortal.com</a>
        </>
      ) : (
        <>
          <div className="mt-6 w-8 h-8 border-[3px] border-[#01696F]/30 border-t-[#01696F] rounded-full animate-spin" />
          <p className="mt-4 text-[15px] text-[#55666A]">Opening the demo…</p>
        </>
      )}
    </div>
  );
}
