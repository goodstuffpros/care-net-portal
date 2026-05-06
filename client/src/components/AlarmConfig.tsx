/**
 * AlarmConfig — bell icon + popover for setting an alarm on a schedule event.
 * Tapping the bell opens a small sheet with toggle + lead time picker.
 * Prominent for MC/Family, subtle for CG.
 */

import { useState } from "react";
import { Bell, BellOff, AlarmClock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useApp } from "@/App";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface AlarmConfigProps {
  eventId: number;
  eventTitle: string;
  eventTime: string;       // ISO string
  alarmEnabled: boolean;
  reminderMinutes: number;
  eventType: string;       // 'appointment' | 'medication' | 'therapy' | 'task' | 'other'
  clientId: number;
}

const LEAD_OPTIONS = [
  { value: 0,   label: "At time of event" },
  { value: 10,  label: "10 minutes before" },
  { value: 15,  label: "15 minutes before" },
  { value: 30,  label: "30 minutes before" },
  { value: 60,  label: "1 hour before" },
  { value: 120, label: "2 hours before" },
];

async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function AlarmConfig({
  eventId, eventTitle, eventTime, alarmEnabled, reminderMinutes, eventType, clientId,
}: AlarmConfigProps) {
  const { activeUser } = useApp();
  const [open, setOpen] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(alarmEnabled);
  const [localMinutes, setLocalMinutes] = useState(reminderMinutes ?? 30);
  const [notifBlocked, setNotifBlocked] = useState(false);

  const isFamily = activeUser.role === "primary_family" || activeUser.role === "secondary_family";
  const isMedOrAppt = eventType === "medication" || eventType === "appointment" || eventType === "therapy";

  const mutation = useMutation({
    mutationFn: (data: { alarmEnabled: boolean; reminderMinutes: number }) =>
      apiRequest("PATCH", `/api/schedule/${eventId}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/client", clientId] });
    },
  });

  async function handleToggle(enabled: boolean) {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted && "Notification" in window && Notification.permission === "denied") {
        setNotifBlocked(true);
      }
    }
    setLocalEnabled(enabled);
    mutation.mutate({ alarmEnabled: enabled, reminderMinutes: localMinutes });
  }

  function handleLeadChange(minutes: number) {
    setLocalMinutes(minutes);
    if (localEnabled) {
      mutation.mutate({ alarmEnabled: true, reminderMinutes: minutes });
    }
  }

  const leadLabel = LEAD_OPTIONS.find(o => o.value === localMinutes)?.label ?? "30 minutes before";

  // Bell appearance
  const bellActive = localEnabled;

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        data-testid={`alarm-btn-${eventId}`}
        className={cn(
          "flex items-center gap-1 rounded-full transition-all",
          // Prominent for family/MC on med+appt, subtle for CG
          isFamily && isMedOrAppt
            ? bellActive
              ? "px-2 py-1 bg-teal-500/20 text-teal-600 dark:text-teal-400 text-xs font-medium border border-teal-300/50 dark:border-teal-700/50"
              : "px-2 py-1 bg-muted text-muted-foreground text-xs hover:bg-muted/80 border border-border"
            : bellActive
              ? "p-1.5 text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-800"
              : "p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-muted rounded-lg border border-border"
        )}
        title={localEnabled ? `Alarm: ${leadLabel}` : "Set alarm"}
      >
        {localEnabled
          ? <Bell size={isFamily && isMedOrAppt ? 13 : 14} className="fill-current" />
          : <BellOff size={isFamily && isMedOrAppt ? 13 : 14} />
        }
        {/* Show lead time label when active for family */}
        {isFamily && isMedOrAppt && localEnabled && (
          <span>{leadLabel.replace(" before", "").replace("At time of event", "on time")}</span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-10">
          <SheetHeader className="mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <AlarmClock size={18} className="text-primary" />
              </div>
              <div>
                <SheetTitle className="text-left text-sm leading-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                  {eventTitle}
                </SheetTitle>
                <p className="text-xs text-muted-foreground text-left">{formatEventTime(eventTime)}</p>
              </div>
            </div>
          </SheetHeader>

          {/* Toggle */}
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium">Alarm</p>
              <p className="text-xs text-muted-foreground">
                {localEnabled ? "Will alert you before this event" : "No alert set"}
              </p>
            </div>
            <button
              onClick={() => handleToggle(!localEnabled)}
              className={cn(
                "w-12 h-6 rounded-full relative transition-colors",
                localEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                localEnabled ? "translate-x-6" : "translate-x-0.5"
              )} />
            </button>
          </div>

          {/* Lead time picker — only when enabled */}
          {localEnabled && (
            <div className="pt-3">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Alert me</p>
              <div className="grid grid-cols-2 gap-2">
                {LEAD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleLeadChange(opt.value)}
                    className={cn(
                      "py-2.5 px-3 rounded-xl text-sm text-left transition-all border",
                      localMinutes === opt.value
                        ? "bg-primary text-primary-foreground border-primary font-medium"
                        : "bg-muted/40 text-foreground border-border hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notification permission warning */}
          {notifBlocked && (
            <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                Browser notifications are blocked. The alarm will still appear while the app is open. To receive alerts when the app is in the background, enable notifications for this site in your browser settings.
              </p>
            </div>
          )}

          {/* In-app only notice for iOS */}
          {localEnabled && !notifBlocked && (
            <p className="text-xs text-muted-foreground/50 mt-3 text-center leading-relaxed">
              Alerts appear while the app is open. Enable browser notifications for background reminders.
            </p>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) +
    " at " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
