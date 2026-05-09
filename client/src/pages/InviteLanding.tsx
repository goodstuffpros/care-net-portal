import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Heart, CheckCircle2, AlertCircle, Loader2, ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    // Check auth
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setIsLoggedIn(!!data?.account);
        setCheckingAuth(false);
      })
      .catch(() => { setCheckingAuth(false); });

    // Validate invite token
    apiRequest("GET", `/api/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) setInvite(data);
        else setError(data.message || "This invite is not valid.");
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load invite details. Please try again.");
        setLoading(false);
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
    return { you: "contact", them: "user" };
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
          <p className="text-[#7A7974] mb-6">{error}</p>
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
