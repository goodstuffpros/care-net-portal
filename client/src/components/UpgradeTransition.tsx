/**
 * UpgradeTransition
 * Full-screen animated color wash that plays when a family upgrades
 * from Family Care Portal → Dedicated Caregiver Portal.
 * Rose/mauve sweeps out, Care Net teal floods in.
 */
import { useEffect, useState } from "react";
import { Heart, Users } from "lucide-react";

interface Props {
  onComplete: () => void;
}

export default function UpgradeTransition({ onComplete }: Props) {
  const [phase, setPhase] = useState<"enter" | "message" | "sweep" | "done">("enter");

  useEffect(() => {
    // Phase 1: fade in
    const t1 = setTimeout(() => setPhase("message"), 400);
    // Phase 2: show message for a moment
    const t2 = setTimeout(() => setPhase("sweep"), 2000);
    // Phase 3: teal sweep completes, call onComplete
    const t3 = setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{ pointerEvents: "all" }}
      aria-live="assertive"
      aria-label="Upgrading to Dedicated Caregiver Portal"
    >
      {/* Rose base layer (family portal color) */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: "linear-gradient(135deg, hsl(340, 55%, 28%) 0%, hsl(355, 45%, 38%) 100%)",
          opacity: phase === "sweep" ? 0 : 1,
          transitionDuration: "1400ms",
        }}
      />

      {/* Teal sweep layer */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, hsl(175, 55%, 22%) 0%, hsl(175, 55%, 32%) 100%)",
          clipPath: phase === "sweep" ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)",
          transition: phase === "sweep" ? "clip-path 1200ms cubic-bezier(0.76, 0, 0.24, 1)" : "none",
        }}
      />

      {/* Content */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-white"
        style={{
          opacity: phase === "enter" ? 0 : phase === "sweep" ? 0 : 1,
          transition: "opacity 400ms ease",
        }}
      >
        {/* Icon cluster */}
        <div className="relative flex items-center justify-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
          >
            <Heart size={36} className="text-white drop-shadow" />
          </div>
          <div
            className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.25)", backdropFilter: "blur(4px)" }}
          >
            <Users size={18} className="text-white" />
          </div>
        </div>

        {/* Message */}
        <div className="text-center px-8 space-y-2 max-w-xs">
          <h2 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            You're not alone anymore.
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
            Welcome to your Dedicated Caregiver Portal. Your care team is with you every step of the way.
          </p>
        </div>

        {/* Dots progress */}
        <div className="flex gap-2 mt-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.5)",
                animation: `pulse-dot 1.2s ease-in-out ${i * 200}ms infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
