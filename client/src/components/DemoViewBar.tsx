/**
 * DemoViewBar — top bar + "view-only" sheet for the no-sign-in demo (/#/demo).
 * Shown only when this tab holds a demo view pass (see lib/demoView.ts).
 */
import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { DEMO_READONLY_EVENT, leaveDemoView } from "@/lib/demoView";

function hasOwnSignIn(): boolean {
  try { return !!(localStorage.getItem("cn_auth_token") || sessionStorage.getItem("cn_auth_token")); } catch { return false; }
}

function startFreeMonth() {
  leaveDemoView("/apply");
}
function exitDemo() {
  if (hasOwnSignIn()) leaveDemoView("/");
  else { try { sessionStorage.removeItem("cn_demo_view_token"); } catch {} window.location.href = "https://www.carenetportal.com"; }
}

export default function DemoViewBar() {
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const on = () => setSheet(true);
    window.addEventListener(DEMO_READONLY_EVENT, on);
    return () => window.removeEventListener(DEMO_READONLY_EVENT, on);
  }, []);

  return (
    <>
      <div className="w-full flex items-center gap-2 px-3 py-2 bg-[#0C4E54] text-white" data-testid="demo-view-bar">
        <Eye className="w-4 h-4 flex-shrink-0 opacity-80" />
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[13px] font-semibold truncate">Demo — view only</div>
          <div className="text-[11px] opacity-75 truncate">Sample family</div>
        </div>
        <button
          onClick={startFreeMonth}
          className="flex-shrink-0 rounded-lg bg-white text-[#0C4E54] text-[13px] font-semibold px-3 py-1.5"
          data-testid="demo-start"
        >
          Start free month
        </button>
        <button onClick={exitDemo} className="flex-shrink-0 text-[13px] font-medium px-2 py-1.5 opacity-90 underline-offset-2 hover:underline" data-testid="demo-exit">
          Exit
        </button>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" data-testid="demo-readonly-sheet">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheet(false)} />
          <div className="relative w-full max-w-sm bg-background rounded-t-2xl sm:rounded-2xl p-6 pb-8 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-[#01696F]/10 flex items-center justify-center mx-auto mb-3">
              <Eye className="w-6 h-6 text-[#01696F]" />
            </div>
            <h2 className="text-lg font-semibold text-center text-foreground">This is a view-only demo</h2>
            <p className="text-sm text-muted-foreground text-center mt-2 leading-relaxed">
              You can look at everything, but nothing can be changed here. Start your free month to try it with your own family.
            </p>
            <button onClick={startFreeMonth} className="mt-5 w-full rounded-xl bg-[#01696F] text-white font-semibold py-3" data-testid="demo-sheet-start">
              Start my free month
            </button>
            <button onClick={() => setSheet(false)} className="mt-2 w-full rounded-xl border border-border text-foreground font-medium py-3" data-testid="demo-sheet-keep">
              Keep looking
            </button>
          </div>
        </div>
      )}
    </>
  );
}
