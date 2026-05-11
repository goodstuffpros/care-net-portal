/**
 * DemoApplyCTA — floating bottom-right card shown only to demo account visitors.
 * Invites them to apply for real beta access. Dismissable for the session.
 */

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DemoApplyCTA() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className={cn(
      "fixed bottom-5 right-5 z-50 w-72 rounded-2xl shadow-xl border",
      "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700",
      "p-4 flex flex-col gap-3"
    )}>
      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="pr-5">
        <p className="text-sm font-semibold text-foreground leading-snug">
          Like what you see?
        </p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Care Net Portal is currently in private beta. Apply for access and set up your own portal for free.
        </p>
      </div>

      <a
        href="/#/apply"
        className={cn(
          "w-full text-center text-sm font-semibold py-2 px-4 rounded-xl transition-colors",
          "bg-teal-600 hover:bg-teal-700 text-white"
        )}
      >
        Apply for beta access
      </a>
    </div>
  );
}
