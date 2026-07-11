/**
 * Care Net Portal — PWA Install Prompt
 *
 * Shows once after first login, dismissed permanently via localStorage.
 * - Android/Desktop Chrome: triggers native browser install prompt (one tap)
 * - iOS Safari: shows step-by-step instructions (Apple doesn't allow programmatic install)
 * - Already installed / dismissed: renders nothing
 */

import { useState, useEffect } from "react";
import { X, Share, PlusSquare, Download } from "lucide-react";

const DISMISSED_KEY = "cnp_install_dismissed";

function getOS(): "ios" | "android" | "desktop" | "unknown" {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/windows|macintosh|linux/i.test(ua)) return "desktop";
  return "unknown";
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [os, setOs] = useState<"ios" | "android" | "desktop" | "unknown">("unknown");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Don't show if already installed or dismissed
    if (isInStandaloneMode()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    setOs(getOS());

    // Capture Android/Chrome install event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS — show after a short delay
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) {
      // Only show in Safari (not in Chrome on iOS which can't install)
      const isChromeiOS = /CriOS/i.test(ua);
      if (!isChromeiOS) {
        setTimeout(() => setShow(true), 2000);
      }
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  }

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") dismiss();
      else dismiss(); // dismiss either way
    } else {
      dismiss();
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 animate-in slide-in-from-bottom-4 duration-300 sm:left-auto sm:right-4 sm:w-80">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <img src="/icon-192.png" alt="Care Net" className="w-7 h-7 rounded-lg" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">Add to Home Screen</p>
              <p className="text-xs text-muted-foreground">Care Net Portal</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>

        {/* Instructions by platform */}
        {os === "ios" ? (
          <div className="space-y-2 mb-4">
            <p className="text-xs text-muted-foreground">Open Care Net Portal like an app — no App Store needed.</p>
            <div className="flex items-center gap-2 text-xs text-foreground">
              <Share size={14} className="text-primary shrink-0" />
              <span>Tap the <strong>Share</strong> button in Safari</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground">
              <PlusSquare size={14} className="text-primary shrink-0" />
              <span>Tap <strong>Add to Home Screen</strong></span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mb-4">
            Install Care Net Portal for quick access — works like an app, no App Store needed.
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {os !== "ios" ? (
            <button
              onClick={handleInstall}
              className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Download size={13} />
              Install
            </button>
          ) : null}
          <button
            onClick={dismiss}
            className="flex-1 text-xs text-muted-foreground py-2 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            {os === "ios" ? "Got it" : "Not now"}
          </button>
        </div>
      </div>
    </div>
  );
}
