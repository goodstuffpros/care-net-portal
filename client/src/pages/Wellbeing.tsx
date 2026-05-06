import { useState } from "react";
import { LessonLauncher } from "@/components/LessonLauncher";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useApp } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Heart, Flame, Star, TrendingUp, Calendar, MessageCircleHeart } from "lucide-react";
import { WellbeingModal } from "@/components/WellbeingModal";

const MOOD_EMOJI: Record<string, string> = {
  exhausted: "😞",
  overwhelmed: "😔",
  stressed: "😐",
  grieving: "💙",
  lonely: "🤍",
  proud: "😊",
  hopeful: "🌱",
  grateful: "💛",
};

const THEME_LABEL: Record<string, string> = {
  burnout: "Exhaustion / Burnout",
  family_stress: "Family Stress",
  difficult_family: "Difficult Dynamics",
  client_decline: "Hard Client Moments",
  personal_crisis: "Personal Crisis",
  general: "General Check-In",
  triumph: "A Win",
};

const BADGE_INFO: Record<string, { icon: string; label: string; desc: string }> = {
  first_checkin: { icon: "💬", label: "First Check-In", desc: "You reached out for the first time." },
  week_streak: { icon: "🔥", label: "7-Day Streak", desc: "7 consecutive days of checking in." },
  month_streak: { icon: "⭐", label: "30-Day Streak", desc: "A full month of showing up for yourself." },
  ten_checkins: { icon: "💛", label: "10 Check-Ins", desc: "You've checked in 10 times. That matters." },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function WellbeingPage() {
  const { activeUser } = useApp();
  const [modalOpen, setModalOpen] = useState(false);

  const isCaregiverRole = ["caregiver", "multi_caregiver", "temp_caregiver"].includes(activeUser.role);

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["/api/wellbeing/history", activeUser.id],
    queryFn: () => apiRequest("GET", `/api/wellbeing/history/${activeUser.id}`).then(r => r.json()),
    enabled: isCaregiverRole,
  });

  const { data: streak } = useQuery({
    queryKey: ["/api/wellbeing/streak", activeUser.id],
    queryFn: () => apiRequest("GET", `/api/wellbeing/streak/${activeUser.id}`).then(r => r.json()),
    enabled: isCaregiverRole,
  });

  const earnedBadges: string[] = JSON.parse(streak?.earnedBadges || "[]");

  if (!isCaregiverRole) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm pt-16">
        This space is for caregivers only.
      </div>
    );
  }

  // Mood trend — count of each rating over recent check-ins
  const ratedCheckIns = history.filter((c: any) => c.moodRating !== null);
  const avgMood = ratedCheckIns.length
    ? (ratedCheckIns.reduce((s: number, c: any) => s + c.moodRating, 0) / ratedCheckIns.length).toFixed(1)
    : null;

  return (
    <div className="p-4 space-y-4 max-w-xl mx-auto pb-8">

      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-lg font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Your Wellbeing
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">A private space — just for you.</p>
          <div className="mt-2"><LessonLauncher pageKey="wellbeing" /></div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors"
        >
          <Heart size={12} className="fill-white" />
          Need a friend
        </button>
      </div>

      {/* Streak card */}
      <Card className="border-border bg-gradient-to-br from-rose-950/30 to-background">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 flex items-center justify-center">
                <Flame size={22} className="text-rose-400" />
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                  {streak?.currentStreak || 0}
                </div>
                <div className="text-xs text-muted-foreground">day streak</div>
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-sm font-semibold">{streak?.totalCheckIns || 0}</div>
              <div className="text-xs text-muted-foreground">total check-ins</div>
              <div className="text-sm font-semibold">{streak?.longestStreak || 0}</div>
              <div className="text-xs text-muted-foreground">longest streak</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mood trend */}
      {avgMood && (
        <Card className="border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <TrendingUp size={18} className="text-amber-500" />
              </div>
              <div>
                <div className="text-sm font-medium">Average mood: {avgMood} / 5</div>
                <div className="text-xs text-muted-foreground">Based on {ratedCheckIns.length} rated check-ins</div>
              </div>
            </div>
            {/* Mood bar */}
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all"
                style={{ width: `${(parseFloat(avgMood) / 5) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Earned badges */}
      {earnedBadges.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <Star size={14} className="text-amber-400" /> Your Milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 gap-2">
              {earnedBadges.map(b => {
                const info = BADGE_INFO[b];
                if (!info) return null;
                return (
                  <div key={b} className="flex items-start gap-2 p-2.5 rounded-xl bg-muted/40 border border-border">
                    <span className="text-lg flex-shrink-0">{info.icon}</span>
                    <div>
                      <div className="text-xs font-medium">{info.label}</div>
                      <div className="text-xs text-muted-foreground leading-tight mt-0.5">{info.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Check-in history */}
      <Card className="border-border">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            <MessageCircleHeart size={14} className="text-rose-400" /> Check-In History
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4 space-y-3">
          {historyLoading ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
              <Heart size={32} className="mx-auto opacity-20" />
              <p>No check-ins yet.</p>
              <p className="text-xs">Tap "Need a friend" anytime you need a moment.</p>
            </div>
          ) : (
            history.map((c: any) => (
              <div key={c.id} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{MOOD_EMOJI[c.detectedMood] || "💭"}</span>
                    <span className="text-xs font-medium">{THEME_LABEL[c.detectedTheme] || "Check-In"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <Calendar size={10} />
                    {formatDate(c.createdAt)}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 italic">"{c.caregiverMessage}"</p>
                {c.aiResponse && (
                  <div className="border-l-2 border-rose-500/40 pl-2.5">
                    <p className="text-xs text-foreground/70 leading-relaxed line-clamp-2">{c.aiResponse}</p>
                  </div>
                )}
                {c.moodRating && (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn("w-1.5 h-1.5 rounded-full", i < c.moodRating ? "bg-rose-400" : "bg-muted-foreground/20")}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">{c.moodRating}/5</span>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <p className="text-center text-xs text-muted-foreground/50 pb-2 leading-relaxed px-4">
        This space is completely private. Your check-ins are never shared with clients, families, or employers.
      </p>

      <WellbeingModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
