/**
 * Care Net Portal — PWA Install Prompt
 *
 * Shows once after first login, dismissed permanently via localStorage.
 * - Android/Desktop Chrome: triggers native browser install prompt (one tap)
 * - iOS Safari: shows step-by-step instructions (Apple doesn't allow programmatic install)
 * - Already installed / dismissed: renders nothing
 */

import { useState, useEffect, useRef } from "react";
import { X, Share, PlusSquare, Download, MoreVertical } from "lucide-react";

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
  // Keep a ref so the manual handler always has access to latest prompt
  const deferredPromptRef = useRef<any>(null);

  useEffect(() => {
    setOs(getOS());

    // Capture Android/Chrome install event — may fire before user taps nav button
    const installHandler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setDeferredPrompt(e);
      if (!isInStandaloneMode() && !localStorage.getItem(DISMISSED_KEY)) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", installHandler);

    // iOS — show after a short delay on first visit
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua) && !/CriOS/i.test(ua)) {
      if (!isInStandaloneMode() && !localStorage.getItem(DISMISSED_KEY)) {
        setTimeout(() => setShow(true), 2000);
      }
    }

    // Manual trigger from nav overlay "Add to Home Screen" link
    // Always show — use ref to get latest deferred prompt
    const manualHandler = () => {
      if (isInStandaloneMode()) return;
      // Clear dismissed flag so manual trigger always works
      localStorage.removeItem(DISMISSED_KEY);
      setShow(true);
    };
    window.addEventListener("cnp:show-install", manualHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", installHandler);
      window.removeEventListener("cnp:show-install", manualHandler);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  }

  async function handleInstall() {
    const prompt = deferredPromptRef.current || deferredPrompt;
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      deferredPromptRef.current = null;
      setDeferredPrompt(null);
      dismiss();
    } else {
      // No deferred prompt available — keep showing manual instructions
      // (user needs to use browser menu)
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
              <p className="text-sm font-semibold text-foreground leading-tight">Install &amp; Create Shortcut</p>
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
        ) : (deferredPromptRef.current || deferredPrompt) ? (
          <p className="text-xs text-muted-foreground mb-4">
            Install Care Net Portal for quick access — works like an app, no App Store needed.
          </p>
        ) : (
          <div className="space-y-2 mb-4">
            <p className="text-xs text-muted-foreground">Install &amp; create a shortcut on your home screen.</p>
            <div className="flex items-center gap-2 text-xs text-foreground">
              <MoreVertical size={14} className="text-primary shrink-0" />
              <span>Tap the <strong>three-dot menu</strong> in Chrome</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground">
              <PlusSquare size={14} className="text-primary shrink-0" />
              <span>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong></span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {os !== "ios" && (deferredPromptRef.current || deferredPrompt) ? (
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
            {os === "ios" ? "Got it" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}
