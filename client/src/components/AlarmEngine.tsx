/**
 * AlarmEngine — mounts once at app root.
 * Polls every 30 seconds for upcoming alarm-enabled events.
 * Fires an in-app banner + browser notification when the alarm time arrives.
 */

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/App";
import { apiRequest } from "@/lib/queryClient";
import { Bell, X, AlarmClock } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlarmBanner {
  id: string;
  eventId: number;
  title: string;
  eventTime: string;
  type: string;
  leadLabel: string;
}

// Singleton guard — only one engine mounts
let engineMounted = false;

export function AlarmEngine() {
  const { activeUser } = useApp();
  const [banners, setBanners] = useState<AlarmBanner[]>([]);
  const firedRef = useRef<Set<string>>(new Set());

  // Request browser notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      // Don't request immediately — wait for first alarm to be set
    }
  }, []);

  useEffect(() => {
    if (engineMounted) return;
    engineMounted = true;

    const check = async () => {
      try {
        const clientId = (activeUser as any).clientId || 1;
        const res = await apiRequest("GET", `/api/schedule/client/${clientId}`);
        const events = await res.json();

        const now = Date.now();

        for (const ev of events) {
          if (!ev.alarmEnabled || ev.isCompleted) continue;

          const eventTime = new Date(ev.scheduledAt).getTime();
          const leadMs = (ev.reminderMinutes ?? 30) * 60 * 1000;
          const fireAt = eventTime - leadMs;

          // Fire window: fireAt to fireAt + 60 seconds
          const key = `alarm-${ev.id}-${ev.scheduledAt}`;
          if (now >= fireAt && now < fireAt + 60000 && !firedRef.current.has(key)) {
            firedRef.current.add(key);

            const leadLabel = formatLead(ev.reminderMinutes ?? 30);
            const banner: AlarmBanner = {
              id: key,
              eventId: ev.id,
              title: ev.title,
              eventTime: formatTime(ev.scheduledAt),
              type: ev.type,
              leadLabel,
            };

            // In-app banner
            setBanners(prev => [...prev, banner]);

            // Browser notification
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(`⏰ ${ev.title}`, {
                body: `${leadLabel} — scheduled at ${formatTime(ev.scheduledAt)}`,
                icon: "/favicon.ico",
                tag: key,
              });
            }

            // Auto-dismiss after 30 seconds
            setTimeout(() => {
              setBanners(prev => prev.filter(b => b.id !== key));
            }, 30000);
          }
        }
      } catch (e) {
        // Silently fail — don't interrupt the app
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => {
      clearInterval(interval);
      engineMounted = false;
    };
  }, []);

  function dismiss(id: string) {
    setBanners(prev => prev.filter(b => b.id !== id));
  }

  if (banners.length === 0) return null;

  return (
    <div className="fixed top-4 left-0 right-0 z-[200] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {banners.map(banner => (
        <div
          key={banner.id}
          className="w-full max-w-sm bg-[hsl(175,55%,20%)] border border-[hsl(175,60%,40%)] rounded-2xl shadow-2xl pointer-events-auto overflow-hidden"
        >
          {/* Pulsing top strip */}
          <div className="h-1 w-full bg-[hsl(175,70%,55%)] animate-pulse" />
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-[hsl(175,55%,28%)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlarmClock size={18} className="text-[hsl(175,70%,65%)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-tight truncate">
                {banner.title}
              </p>
              <p className="text-white/60 text-xs mt-0.5">
                {banner.leadLabel} · {banner.eventTime}
              </p>
            </div>
            <button
              onClick={() => dismiss(banner.id)}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 hover:bg-white/20 transition-colors"
            >
              <X size={13} className="text-white/70" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatLead(minutes: number): string {
  if (minutes === 0) return "Now";
  if (minutes < 60) return `${minutes} min reminder`;
  return `${minutes / 60}h reminder`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
