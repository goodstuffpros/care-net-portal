/**
 * DailyNudge — context-aware in-app prompts for caregivers
 *
 * Shown as a dismissible banner at the top of the main content area.
 * Evaluates several signals and surfaces the single most relevant nudge.
 *
 * Nudge priority order:
 *  1. No clock-in today (and it's been > 4 hours since last shift ended)
 *  2. Clocked in but no activity logged today
 *  3. No message to family in > 48 hours
 *  4. Medications tab not visited in current shift (day 1–7)
 *  5. Collection of Thoughts — hasn't added an entry in > 14 days
 *  6. Badge survey pending (family hasn't been prompted this month)
 *  7. Onboarding day 2–30: rotating feature discovery tips
 *
 * Dismissed nudges are stored in React state (not localStorage) —
 * they reset on page refresh, which is intentional for a caregiving context.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useApp, isCaregiverRole } from "@/App";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  X, Timer, ClipboardList, MessageSquare, BookHeart,
  Pill, Award, Sparkles, ChevronRight, Info, SlidersHorizontal
} from "lucide-react";
import type { Shift } from "@shared/schema";
import type { ActivityLog } from "@shared/schema";
import type { Message } from "@shared/schema";
import type { ThoughtEntry } from "@shared/schema";

// ── Nudge definitions ─────────────────────────────────────────────────────────

interface Nudge {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  text: string;
  linkLabel?: string;
  linkPath?: string;
  priority: number; // lower = higher priority
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DailyNudge() {
  const { activeUser, selectedClientId } = useApp();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // For Primary FC: show scope inactivity prompt
  if (activeUser.role === "primary_family") {
    return <FamilyScopePromptInner
      clientId={selectedClientId}
      caregiverId={1}
      dismissed={dismissed}
      onDismiss={(id) => setDismissed(prev => new Set([...prev, id]))}
    />;
  }

  // Only show for caregiver roles
  if (!isCaregiverRole(activeUser.role)) return null;

  return <NudgeInner
    userId={activeUser.id}
    clientId={selectedClientId}
    dismissed={dismissed}
    onDismiss={(id) => setDismissed(prev => new Set([...prev, id]))}
  />;
}

// ── Family: 7-day inactivity prompt ───────────────────────────────────────────
// Shown to Primary FC when medications or vitals go unlogged for 7+ days.
// Asks if the care focus has shifted rather than silently flagging the caregiver.

interface CareScope {
  medications: boolean;
  vitals: boolean;
  appointments: boolean;
}

function FamilyScopePromptInner({
  clientId, caregiverId, dismissed, onDismiss,
}: {
  clientId: number;
  caregiverId: number;
  dismissed: Set<string>;
  onDismiss: (id: string) => void;
}) {
  // Fetch scope settings
  const { data: scope } = useQuery<CareScope>({
    queryKey: ["/api/scope", clientId, caregiverId],
    queryFn: () => apiRequest("GET", `/api/scope/${clientId}/${caregiverId}`).then(r => r.json()),
  });

  // Fetch medication logs to check last entry date
  const { data: medLogs = [] } = useQuery<Array<{ loggedAt: string }>>({
    queryKey: ["/api/clients", clientId, "medication-logs"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/medication-logs`).then(r => r.json()),
    enabled: scope?.medications !== false,
  });

  // Fetch vitals to check last entry date
  const { data: vitals = [] } = useQuery<Array<{ recordedAt: string }>>({
    queryKey: ["/api/clients", clientId, "vitals"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/vitals`).then(r => r.json()),
    enabled: scope?.vitals !== false,
  });

  const prompts = useMemo(() => {
    const results: Array<{ id: string; module: string; label: string }> = [];
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Check medications inactivity
    if (scope?.medications !== false && medLogs.length > 0) {
      const lastMed = new Date(medLogs[0].loggedAt).getTime();
      if (now - lastMed > SEVEN_DAYS_MS) {
        results.push({
          id: "scope-med-inactivity",
          module: "Medication",
          label: "It looks like medications haven't been logged recently. Has the care focus shifted? You can update tracking settings here.",
        });
      }
    }

    // Check vitals inactivity
    if (scope?.vitals !== false && vitals.length > 0) {
      const lastVital = new Date(vitals[0].recordedAt).getTime();
      if (now - lastVital > SEVEN_DAYS_MS) {
        results.push({
          id: "scope-vital-inactivity",
          module: "Vitals",
          label: "Vitals haven't been logged recently. Has the care focus shifted? You can update tracking settings here.",
        });
      }
    }

    return results;
  }, [scope, medLogs, vitals]);

  const activePrompt = prompts.find(p => !dismissed.has(p.id));
  if (!activePrompt) return null;

  return (
    <div
      data-testid={`scope-prompt-${activePrompt.id}`}
      className={cn(
        "flex items-start gap-3 mx-4 mt-4 px-4 py-3 rounded-xl border",
        "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40",
        "animate-in slide-in-from-top-2 duration-300"
      )}
    >
      <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5 text-white">
        <SlidersHorizontal size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-amber-900 dark:text-amber-200 leading-snug">{activePrompt.label}</p>
        <Link
          href="/care-scope"
          className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
        >
          Update care scope settings <ChevronRight size={11} />
        </Link>
      </div>
      <button
        onClick={() => onDismiss(activePrompt.id)}
        className="p-1 rounded text-amber-600 hover:text-amber-800 hover:bg-amber-100 transition-colors flex-shrink-0 mt-0.5"
        title="Dismiss"
        data-testid={`scope-prompt-dismiss-${activePrompt.id}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function NudgeInner({
  userId, clientId, dismissed, onDismiss,
}: {
  userId: number;
  clientId: number;
  dismissed: Set<string>;
  onDismiss: (id: string) => void;
}) {
  const today = todayISO();

  // ── Data fetches ────────────────────────────────────────────────────────
  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ["/api/caregivers", userId, "shifts"],
    queryFn: () => apiRequest("GET", `/api/caregivers/${userId}/shifts`).then(r => r.json()),
  });

  const { data: activityLogs = [] } = useQuery<ActivityLog[]>({
    queryKey: ["/api/clients", clientId, "activity"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/activity`).then(r => r.json()),
  });

  const { data: thoughts = [] } = useQuery<ThoughtEntry[]>({
    queryKey: ["/api/clients", clientId, "thoughts"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/thoughts`).then(r => r.json()),
  });

  const { data: userRecord } = useQuery<any>({
    queryKey: ["/api/users", userId],
    queryFn: () => apiRequest("GET", `/api/users/${userId}`).then(r => r.json()),
  });

  // ── Compute nudges ──────────────────────────────────────────────────────
  const nudges: Nudge[] = useMemo(() => {
    const result: Nudge[] = [];

    // ── 1. No clock-in today ─────────────────────────────────────────────
    const hasClockInToday = shifts.some(s => s.clockedInAt?.startsWith(today));
    const isCurrentlyClocked = shifts.some(s => s.clockedInAt && !s.clockedOutAt);
    const lastShift = shifts[0];
    const lastShiftEndedHoursAgo = lastShift?.clockedOutAt
      ? hoursAgo(lastShift.clockedOutAt)
      : null;

    if (!hasClockInToday && !isCurrentlyClocked && (lastShiftEndedHoursAgo === null || lastShiftEndedHoursAgo > 4)) {
      result.push({
        id: "no-clockin-today",
        icon: <Timer size={15} />,
        iconBg: "bg-teal-500",
        text: "Starting your shift? Don't forget to clock in — it keeps your Dependability score accurate.",
        linkLabel: "Go to Dashboard",
        linkPath: "/",
        priority: 1,
      });
    }

    // ── 2. Clocked in but no activity logged today ───────────────────────
    if (isCurrentlyClocked) {
      const hasActivityToday = activityLogs.some(a => a.loggedAt?.startsWith(today));
      if (!hasActivityToday) {
        result.push({
          id: "no-activity-today",
          icon: <ClipboardList size={15} />,
          iconBg: "bg-indigo-500",
          text: "You're clocked in but haven't logged anything yet today. One quick note goes a long way with the family.",
          linkLabel: "Open Activity Log",
          linkPath: "/activity",
          priority: 2,
        });
      }
    }

    // ── 3. No message to family in > 48 hours ────────────────────────────
    // (We approximate using activityLogs as a proxy — a dedicated messages
    //  query would be more accurate, but this avoids a thread-lookup cascade)
    const lastActivityTime = activityLogs[0]?.loggedAt
      ? hoursAgo(activityLogs[0].loggedAt)
      : 999;
    if (lastActivityTime > 48) {
      result.push({
        id: "no-recent-message",
        icon: <MessageSquare size={15} />,
        iconBg: "bg-violet-500",
        text: "The family hasn't heard from you in a while. A brief update keeps everyone at ease.",
        linkLabel: "Open Messages",
        linkPath: "/messages",
        priority: 3,
      });
    }

    // ── 4. Thoughts — no entry in > 14 days ─────────────────────────────
    const lastThought = thoughts[0];
    if (!lastThought) {
      result.push({
        id: "no-thoughts-yet",
        icon: <BookHeart size={15} />,
        iconBg: "bg-amber-500",
        text: "Has your client shared any stories or memories lately? A Collection of Thoughts is waiting for them.",
        linkLabel: "Open Collection",
        linkPath: "/thoughts",
        priority: 4,
      });
    } else {
      const thoughtAge = hoursAgo(lastThought.recordedAt) / 24;
      if (thoughtAge > 14) {
        result.push({
          id: "stale-thoughts",
          icon: <BookHeart size={15} />,
          iconBg: "bg-amber-500",
          text: "It's been a while since you added to the Collection of Thoughts. Any stories worth preserving?",
          linkLabel: "Open Collection",
          linkPath: "/thoughts",
          priority: 4,
        });
      }
    }

    // ── 5. Medications reminder (day 1–7 onboarding) ─────────────────────
    if (userRecord?.onboardingCompletedAt) {
      const daysSinceOnboarding = hoursAgo(userRecord.onboardingCompletedAt) / 24;
      if (daysSinceOnboarding <= 7) {
        result.push({
          id: "medications-discovery",
          icon: <Pill size={15} />,
          iconBg: "bg-rose-500",
          text: "Tip: Log medications in the Medications module — it boosts your Knowledge score and keeps the family informed.",
          linkLabel: "Open Medications",
          linkPath: "/medications",
          priority: 5,
        });
      }
    }

    // ── 6. Badge awareness (day 8–30) ────────────────────────────────────
    if (userRecord?.onboardingCompletedAt) {
      const daysSinceOnboarding = hoursAgo(userRecord.onboardingCompletedAt) / 24;
      if (daysSinceOnboarding > 7 && daysSinceOnboarding <= 30) {
        result.push({
          id: "badge-awareness",
          icon: <Award size={15} />,
          iconBg: "bg-primary",
          text: "Your Care Badge is building. Every shift, note, and message contributes to your professional score.",
          linkLabel: "View My Badge",
          linkPath: "/badges",
          priority: 6,
        });
      }
    }

    return result.sort((a, b) => a.priority - b.priority);
  }, [shifts, activityLogs, thoughts, userRecord, today]);

  // Find highest-priority undismissed nudge
  const activeNudge = nudges.find(n => !dismissed.has(n.id));
  if (!activeNudge) return null;

  return (
    <div
      data-testid={`nudge-${activeNudge.id}`}
      className={cn(
        "flex items-start gap-3 mx-4 mt-4 px-4 py-3 rounded-xl border",
        "bg-card border-border shadow-sm",
        "animate-in slide-in-from-top-2 duration-300"
      )}
    >
      {/* Icon */}
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-white", activeNudge.iconBg)}>
        {activeNudge.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground/85 leading-snug">
          {activeNudge.text}
        </p>
        {activeNudge.linkLabel && activeNudge.linkPath && (
          <Link
            href={activeNudge.linkPath}
            className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-primary hover:underline"
          >
            {activeNudge.linkLabel}
            <ChevronRight size={11} />
          </Link>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(activeNudge.id)}
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0 mt-0.5"
        title="Dismiss"
        data-testid={`nudge-dismiss-${activeNudge.id}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}
