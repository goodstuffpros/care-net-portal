import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Heart, CheckCircle2, AlertCircle, Loader2, ArrowRight, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// Detect in-app browsers (Messenger, Instagram, Facebook, etc.)
function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|MessengerForiOS|FB_IAB|FB4A|FBIOS|LinkedInApp|Twitter|Snapchat|TikTok|WebView/.test(ua)
    || (/iPhone|iPod|iPad/.test(ua) && !/(Safari)/.test(ua) && /(AppleWebKit)/.test(ua));
}

interface InviteContext {
  valid: boolean;
  senderName: string;
  senderRole: string;
  clientName: string | null;
  inviteType: string;
  invitedEmail: string | null;
}

export default function InviteLanding({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [invite, setInvite] = useState<InviteContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Check if user is logged in
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  // If we were redirected here after login, auto-attempt accept
  const justLoggedIn = sessionStorage.getItem("pending_invite_token") === token;

  // Detect in-app browser on mount
  const inAppBrowser = isInAppBrowser();
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const [inAppCopied, setInAppCopied] = useState(false);

  useEffect(() => {
    // Check auth + validate invite in parallel
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
      apiRequest("GET", `/api/invite/${token}`)
        .then(r => r.json())
        .catch(() => null),
    ]).then(([authData, inviteData]) => {
      const loggedIn = !!authData?.account;
      setIsLoggedIn(loggedIn);
      setCheckingAuth(false);

      if (inviteData?.valid) setInvite(inviteData);
      else setError(inviteData?.message || "This invite is not valid.");
      setLoading(false);

      // Auto-accept if we just redirected here after login
      if (loggedIn && justLoggedIn && inviteData?.valid) {
        sessionStorage.removeItem("pending_invite_token");
        setAccepting(true);
        apiRequest("POST", `/api/invite/${token}/accept`, {})
          .then(r => r.json())
          .then(data => {
            if (data.success) {
              setAccepted(true);
              setTimeout(() => { window.location.href = "/"; }, 2500);
            } else {
              setAccepting(false);
            }
          })
          .catch(() => setAccepting(false));
      }
    });
  }, [token]);

  async function handleAccept() {
    if (!isLoggedIn) {
      // Store token in session and redirect to login/signup
      sessionStorage.setItem("pending_invite_token", token);
      setLocation("/#/apply?invite=" + token);
      return;
    }
    setAccepting(true);
    try {
      const r = await apiRequest("POST", `/api/invite/${token}/accept`, {});
      const data = await r.json();
      if (data.success) {
        setAccepted(true);
        toast({ title: "Connected!", description: "Your portals are now linked." });
        setTimeout(() => {
          // Reload app so RealAuthGate picks up the new clientId
          window.location.href = "/";
        }, 2500);
      } else {
        toast({ title: "Could not connect", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  }

  function roleLabel(inviteType: string, senderRole: string) {
    if (inviteType === "mc_to_caregiver") return { you: "caregiver", them: "family" };
    if (inviteType === "caregiver_to_mc") return { you: "family contact", them: "caregiver" };
    if (inviteType === "mc_to_family") return { you: "family member", them: "family contact" };
    if (inviteType === "mc_to_self_cg") return { you: "Self-Caregiver", them: "Main Contact" };
    if (inviteType === "self_care_to_mc") return { you: "Main Contact", them: "the portal owner" };
    return { you: "contact", them: "user" };
  }

  // In-app browser intercept — show immediately, before spinner, before any fetch
  if (inAppBrowser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F2] p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[#D4D1CA] p-8 text-center">
          <div className="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ExternalLink className="w-7 h-7 text-[#01696F]" />
          </div>
          <h2 className="text-xl font-semibold text-[#28251D] mb-2">One more step</h2>
          <p className="text-[#7A7974] text-sm mb-2 leading-relaxed">
            This link needs to open in <strong>Safari or Chrome</strong> — Messenger can't complete the connection.
          </p>
          <p className="text-[#7A7974] text-sm mb-5 leading-relaxed">
            Copy the link below, then open Safari or Chrome and paste it in the address bar.
          </p>

          {/* Copyable URL box */}
          <div className="bg-[#F7F6F2] border border-[#D4D1CA] rounded-xl px-3 py-2.5 mb-4 text-left">
            <p className="text-xs text-[#7A7974] mb-1 font-medium">Your invite link</p>
            <p className="text-xs text-[#28251D] break-all leading-relaxed font-mono select-all">{currentUrl}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(currentUrl).then(() => {
                setInAppCopied(true);
                setTimeout(() => setInAppCopied(false), 3000);
              });
            }}
            className="w-full bg-[#01696F] text-white font-medium py-3 px-4 rounded-xl text-sm transition-colors mb-3"
          >
            {inAppCopied ? "✓ Link copied!" : "Copy link"}
          </button>

          <p className="text-xs text-[#BAB9B4] leading-relaxed">
            After copying, open Safari or Chrome, tap the address bar, and paste.
          </p>
        </div>
      </div>
    );
  }

  if (loading || checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F2]">
        <Loader2 className="w-8 h-8 text-[#01696F] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F2] p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[#D4D1CA] p-8 text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#28251D] mb-2">Invite Unavailable</h2>
          <p className="text-[#7A7974] mb-4 text-sm">{error}</p>
          <p className="text-[#7A7974] text-xs mb-6 leading-relaxed">
            If someone sent you this link through Messenger or another app, try opening it directly in Safari or Chrome instead.
          </p>
          <Button onClick={() => setLocation("/")} variant="outline">
            Go to Care Net Portal
          </Button>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F2] p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[#D4D1CA] p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-[#28251D] mb-2">Portals Connected</h2>
          <p className="text-[#7A7974]">Taking you to your portal now…</p>
        </div>
      </div>
    );
  }

  const labels = roleLabel(invite!.inviteType, invite!.senderRole);

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-4">
        {/* Header card */}
        <div className="bg-[#01696F] rounded-2xl p-6 text-white text-center">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Heart className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Care Net Portal</h1>
          <p className="text-white/75 text-sm mt-1">Private care coordination</p>
        </div>

        {/* Invite details */}
        <div className="bg-white rounded-2xl border border-[#D4D1CA] p-6 space-y-4">
          <div className="text-center space-y-2">
            <p className="text-[#7A7974] text-sm">You've been invited by</p>
            <p className="text-[#28251D] text-xl font-semibold">{invite!.senderName}</p>
            {invite!.clientName && (
              <p className="text-[#7A7974] text-sm">
                to connect as a <span className="font-medium text-[#01696F]">{labels.you}</span> for{" "}
                <span className="font-medium text-[#28251D]">{invite!.clientName}</span>
              </p>
            )}
            {!invite!.clientName && (
              <p className="text-[#7A7974] text-sm">
                to join as a <span className="font-medium text-[#01696F]">{labels.you}</span>
              </p>
            )}
          </div>

          <div className="bg-[#F7F6F2] rounded-xl p-4 space-y-2">
            <div className="flex items-start gap-3">
              <Users className="w-4 h-4 text-[#01696F] mt-0.5 flex-shrink-0" />
              <p className="text-[#5A5957] text-sm">
                Once you accept, your portals will be linked. You'll each see care updates in real time.
              </p>
            </div>
          </div>

          <Button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full bg-[#01696F] hover:bg-[#0C4E54] text-white h-12 text-base font-medium"
          >
            {accepting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting…</>
            ) : isLoggedIn ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> Accept & Connect Portals</>
            ) : (
              <><ArrowRight className="w-4 h-4 mr-2" /> Create Account to Accept</>
            )}
          </Button>

          {!isLoggedIn && (
            <div className="text-center space-y-2">
              <p className="text-xs text-[#BAB9B4]">
                New to Care Net Portal? You'll create your account first, then connect automatically.
              </p>
              <p className="text-xs text-[#7A7974]">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.setItem("pending_invite_token", token);
                    window.location.href = "/#/login?invite=" + token;
                  }}
                  className="font-semibold text-[#01696F] underline underline-offset-2"
                >
                  Log in to accept
                </button>
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[#BAB9B4]">
          This invitation expires in 7 days · Care Net Portal · carenetportal.com
        </p>
      </div>
    </div>
  );
}
