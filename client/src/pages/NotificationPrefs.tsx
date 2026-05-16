import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bell, Siren, AlertTriangle, Info, BookOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/App";

// ── New tier-based prefs schema ────────────────────────────────────────────────
// urgentEmail:    email when Urgent in-app bell fires
// importantEmail: email when Important in-app bell fires
// normalBell:     show Normal events in bell at all (no email option)
// importantBell:  show Important in bell (always on for CG/MC, default off for SFM)
//
// Emergency is never toggled — always delivered.

interface TierPrefs {
  urgentEmail: boolean;
  importantBell: boolean;
  importantEmail: boolean;
  normalBell: boolean;
}

function defaultPrefs(role: string): TierPrefs {
  const isSfm = role === "secondary_family";
  return {
    urgentEmail: true,
    importantBell: !isSfm,   // default off for SFM
    importantEmail: false,
    normalBell: true,
  };
}

export default function NotificationPrefs({ portalMode }: { portalMode?: string }) {
  const { activeUser } = useApp();
  const { toast } = useToast();
  const isFcp = portalMode === "family" || activeUser.role === "primary_family";
  const isSfm = activeUser.role === "secondary_family";
  const bgLight = isFcp ? "#F9EEF3" : "#E6F2F2";
  const headerAccent = isFcp ? "#9B3A5C" : "#01696F";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/notifications/prefs"],
    queryFn: () => apiRequest("GET", "/api/notifications/prefs").then(r => r.json()),
  });

  // Merge saved prefs with defaults (handles old format gracefully)
  const saved = data?.prefs ?? {};
  const prefs: TierPrefs = {
    urgentEmail:    saved.urgentEmail    ?? defaultPrefs(activeUser.role).urgentEmail,
    importantBell:  saved.importantBell  ?? defaultPrefs(activeUser.role).importantBell,
    importantEmail: saved.importantEmail ?? false,
    normalBell:     saved.normalBell     ?? true,
  };

  const mutation = useMutation({
    mutationFn: (newPrefs: TierPrefs) =>
      apiRequest("PATCH", "/api/notifications/prefs", { prefs: newPrefs }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/prefs"] });
      toast({ title: "Preferences saved" });
    },
    onError: () => toast({ title: "Error", description: "Could not save preferences.", variant: "destructive" }),
  });

  function toggle(key: keyof TierPrefs) {
    mutation.mutate({ ...prefs, [key]: !prefs[key] });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bgLight }}>
          <Bell className="w-5 h-5" style={{ color: headerAccent }} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Notification Preferences</h1>
          <p className="text-sm text-muted-foreground">Choose how you want to be reached</p>
        </div>
      </div>

      {/* ── Tier 0: Emergency ── */}
      <TierCard
        icon={<Siren className="w-4 h-4 text-red-600 dark:text-red-400" />}
        iconBg="bg-red-50 dark:bg-red-950/30"
        label="Emergency"
        labelColor="text-red-700 dark:text-red-400"
        description="Triggered manually by your caregiver or Main Contact for critical situations."
        rows={[
          { label: "In-app alert", locked: true, value: true, description: "Always on — cannot be turned off" },
          { label: "SMS", locked: true, value: false, description: "Coming soon — Twilio integration pending" },
        ]}
      />

      {/* ── Tier 1: Urgent ── */}
      <TierCard
        icon={<AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
        iconBg="bg-amber-50 dark:bg-amber-950/30"
        label="Urgent"
        labelColor="text-amber-700 dark:text-amber-500"
        description="Allergy changes, medication updates, incidents, and flagged vitals."
        rows={[
          { label: "In-app alert", locked: true, value: true, description: "Always on — cannot be turned off" },
          {
            label: "Email",
            locked: false,
            value: prefs.urgentEmail,
            description: "Send an email when an Urgent alert fires",
            onToggle: () => toggle("urgentEmail"),
            disabled: mutation.isPending,
          },
        ]}
      />

      {/* ── Tier 2: Important ── */}
      <TierCard
        icon={<Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
        iconBg="bg-blue-50 dark:bg-blue-950/30"
        label="Important"
        labelColor="text-blue-700 dark:text-blue-400"
        description="New messages, schedule changes, documents, and handoff notes."
        rows={[
          {
            label: "In-app alert",
            locked: isSfm ? false : true,
            value: prefs.importantBell,
            description: isSfm
              ? "Secondary family members receive these only when turned on"
              : "Always on for caregivers and Main Contact",
            onToggle: isSfm ? () => toggle("importantBell") : undefined,
            disabled: mutation.isPending,
          },
          {
            label: "Email",
            locked: false,
            value: prefs.importantEmail,
            description: "Send an email for Important alerts",
            onToggle: () => toggle("importantEmail"),
            disabled: mutation.isPending,
          },
        ]}
      />

      {/* ── Tier 3: Normal ── */}
      <TierCard
        icon={<BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
        iconBg="bg-emerald-50 dark:bg-emerald-950/30"
        label="Normal"
        labelColor="text-emerald-700 dark:text-emerald-500"
        description="Routine care log entries, vitals in normal range, media added, and outings. You'll see these when you open the app."
        rows={[
          { label: "In-app alert", locked: true, value: false, description: "No bell — review at your own pace" },
          { label: "Email", locked: true, value: false, description: "No email for Normal activity" },
        ]}
      />

      <p className="text-xs text-muted-foreground text-center pt-2">
        Emails go to your registered address. You can update these at any time.
      </p>
    </div>
  );
}

// ── Shared tier card ───────────────────────────────────────────────────────────
interface ToggleRow {
  label: string;
  locked: boolean;
  value: boolean;
  description: string;
  onToggle?: () => void;
  disabled?: boolean;
}

function TierCard({
  icon, iconBg, label, labelColor, description, rows,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  labelColor: string;
  description: string;
  rows: ToggleRow[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", iconBg)}>
          {icon}
        </div>
        <div>
          <span className={cn("text-sm font-semibold", labelColor)}>{label}</span>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      {/* Rows */}
      <div className="border-t border-border divide-y divide-border">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", row.locked || !row.value ? "text-muted-foreground" : "text-foreground")}>
                {row.label}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">{row.description}</p>
            </div>
            {row.locked ? (
              <span className={cn(
                "text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0",
                row.value
                  ? "bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {row.value ? "Always on" : "Off"}
              </span>
            ) : (
              <button
                onClick={row.onToggle}
                disabled={row.disabled}
                className={cn(
                  "relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50",
                  row.value ? "bg-teal-600" : "bg-zinc-300 dark:bg-zinc-600"
                )}
                style={row.value ? { backgroundColor: "#01696F" } : {}}
                data-testid={`notif-toggle-${row.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <span className={cn(
                  "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                  row.value ? "translate-x-5" : "translate-x-0"
                )} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
