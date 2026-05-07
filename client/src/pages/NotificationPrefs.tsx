import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bell, NotebookPen, MessageSquare, CalendarDays, Activity, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface NotifPrefs {
  careLog: boolean;
  messages: boolean;
  schedule: boolean;
  vitals: boolean;
}

const PREF_OPTIONS = [
  {
    key: "careLog" as keyof NotifPrefs,
    icon: NotebookPen,
    label: "Care Log entries",
    desc: "Email when a new Care Log entry is added",
    cgOnly: false,
  },
  {
    key: "messages" as keyof NotifPrefs,
    icon: MessageSquare,
    label: "New messages",
    desc: "Email when you receive a new message",
    cgOnly: false,
  },
  {
    key: "schedule" as keyof NotifPrefs,
    icon: CalendarDays,
    label: "Schedule updates",
    desc: "Email when a new event is added to the schedule",
    cgOnly: false,
  },
  {
    key: "vitals" as keyof NotifPrefs,
    icon: Activity,
    label: "Vitals logged",
    desc: "Email when new vitals are recorded",
    cgOnly: false,
  },
];

export default function NotificationPrefs({ portalMode }: { portalMode?: string }) {
  const { toast } = useToast();
  const isFcp = portalMode === "family";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/notifications/prefs"],
    queryFn: () => apiRequest("GET", "/api/notifications/prefs").then(r => r.json()),
  });

  const prefs: NotifPrefs = data?.prefs ?? { careLog: true, messages: true, schedule: true, vitals: false };

  const mutation = useMutation({
    mutationFn: (newPrefs: NotifPrefs) =>
      apiRequest("PATCH", "/api/notifications/prefs", { prefs: newPrefs }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/prefs"] });
      toast({ title: "Preferences saved" });
    },
    onError: () => toast({ title: "Error", description: "Could not save preferences.", variant: "destructive" }),
  });

  function toggle(key: keyof NotifPrefs) {
    mutation.mutate({ ...prefs, [key]: !prefs[key] });
  }

  const accentColor = isFcp ? "#9B3A5C" : "#01696F";
  const bgLight = isFcp ? "#F9EEF3" : "#E6F2F2";

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: bgLight }}
        >
          <Bell className="w-5 h-5" style={{ color: accentColor }} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[#28251D]">Notification Preferences</h1>
          <p className="text-sm text-[#7A7974]">Choose which events send you an email</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#7A7974]" />
        </div>
      ) : (
        <div className="space-y-3">
          {PREF_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const enabled = prefs[opt.key];
            return (
              <div
                key={opt.key}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-xl border p-4 transition-all",
                  enabled
                    ? "bg-white border-[#D4D1CA]"
                    : "bg-[#F7F6F2] border-[#E8E6E0]"
                )}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: enabled ? bgLight : "#F0EFEB" }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: enabled ? accentColor : "#BAB9B4" }}
                    />
                  </div>
                  <div>
                    <p className={cn("text-sm font-medium", enabled ? "text-[#28251D]" : "text-[#7A7974]")}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-[#BAB9B4] mt-0.5">{opt.desc}</p>
                  </div>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={() => toggle(opt.key)}
                  disabled={mutation.isPending}
                  className="flex-shrink-0"
                  style={enabled ? { backgroundColor: accentColor } : {}}
                />
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[#BAB9B4] text-center pt-2">
        Emails are sent to your registered address. You can update these at any time.
      </p>
    </div>
  );
}
