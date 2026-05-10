import { useApp, isCaregiverRole } from "@/App";
import { useLang } from "@/lib/useLang";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Outing, Client } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { MapPin, Play, Square, Clock, CheckCircle2, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { LessonLauncher } from "@/components/LessonLauncher";

// Fix default marker icons for Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const OUTING_TYPES = [
  { value: "lunch", label: "🍽️ Lunch" },
  { value: "shopping", label: "🛒 Shopping" },
  { value: "doctor", label: "🏥 Doctor" },
  { value: "drive", label: "🚗 Drive" },
  { value: "errands", label: "📋 Errands" },
  { value: "other", label: "📍 Other" },
];

const TYPE_LABELS: Record<string, string> = {
  lunch: "🍽️ Lunch",
  shopping: "🛒 Shopping",
  doctor: "🏥 Doctor Appointment",
  drive: "🚗 Drive",
  errands: "📋 Errands",
  other: "📍 Outing",
};

// Dallas coordinates for demo
const DEFAULT_LAT = 32.7767;
const DEFAULT_LNG = -96.7970;

function useElapsedTime(startedAt: string | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function LeafletMap({ lat, lng, pulsing }: { lat: number; lng: number; pulsing?: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const marker = L.marker([lat, lng]).addTo(map);
    marker.bindPopup("Last known location").openPopup();

    if (pulsing) {
      L.circle([lat, lng], { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, radius: 200 }).addTo(map);
    }

    mapInstanceRef.current = map;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [lat, lng, pulsing]);

  return <div ref={mapRef} className="h-64 rounded-xl border border-border z-0" />;
}

export default function OutingsPage() {
  const { selectedClientId, activeUser } = useApp();
  const { t } = useLang();
  const { toast } = useToast();
  const isCaregiver = isCaregiverRole(activeUser.role);

  const [outingType, setOutingType] = useState("lunch");
  const [note, setNote] = useState("");

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("GET", "/api/clients").then(r => r.json()),
  });
  const client = clients.find(c => c.id === selectedClientId);

  const { data: allOutings = [], isLoading } = useQuery<Outing[]>({
    queryKey: ["/api/clients", selectedClientId, "outings"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/outings`).then(r => r.json()),
    refetchInterval: 15000,
  });

  const { data: portalUsers = [] } = useQuery<{ id: number; name: string; role: string }[]>({
    queryKey: ["/api/clients", selectedClientId, "family"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/family`).then(r => r.json()),
    enabled: !!selectedClientId,
  });
  const familyUserIds = portalUsers
    .filter(u => u.role === "primary_family" || u.role === "secondary_family")
    .map(u => u.id);

  const { data: activeOuting } = useQuery<Outing | null>({
    queryKey: ["/api/clients", selectedClientId, "outings", "active"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/outings/active`).then(r => r.json()),
    refetchInterval: 10000,
  });

  const elapsedStr = useElapsedTime(activeOuting?.startedAt ?? null);

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${selectedClientId}/outings`, {
      caregiverId: activeUser.id,
      type: outingType,
      note: note || null,
      status: "active",
      startedAt: new Date().toISOString(),
      lastLatitude: DEFAULT_LAT,
      lastLongitude: DEFAULT_LNG,
      lastLocationLabel: "Dallas, TX (simulated)",
    }),
    onSuccess: async (res) => {
      const outing = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "outings"] });
      toast({ title: "Outing started!", description: `${TYPE_LABELS[outingType]} started. Family has been notified.` });
      // Notify family members
      for (const userId of familyUserIds) {
        await apiRequest("POST", "/api/notifications", {
          userId,
          clientId: selectedClientId,
          title: "Outing Started",
          body: `\ud83d\ude97 ${activeUser.name} started an outing with ${client?.name || "client"} \u00b7 ${TYPE_LABELS[outingType]} \u00b7 ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
          type: "alert",
          priority: "green",
          isRead: false,
          createdAt: new Date().toISOString(),
          linkTo: "/outings",
        }).catch(() => {});
      }
      setNote("");
    },
  });

  const endMutation = useMutation({
    mutationFn: (id: number) => {
      const startTime = activeOuting ? new Date(activeOuting.startedAt).getTime() : Date.now();
      const duration = Math.round((Date.now() - startTime) / 60000);
      return apiRequest("PATCH", `/api/outings/${id}`, {
        status: "completed",
        endedAt: new Date().toISOString(),
        durationMinutes: duration || 1,
      });
    },
    onSuccess: async (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "outings"] });
      const duration = activeOuting
        ? Math.round((Date.now() - new Date(activeOuting.startedAt).getTime()) / 60000)
        : 0;
      toast({ title: "Outing ended", description: `${client?.name || "Client"} returned safely.` });
      // Notify family
      for (const userId of familyUserIds) {
        await apiRequest("POST", "/api/notifications", {
          userId,
          clientId: selectedClientId,
          title: "Outing Completed",
          body: `\u2705 ${client?.name || "Client"} returned safely \u00b7 Outing lasted ${duration} min`,
          type: "alert",
          priority: "green",
          isRead: false,
          createdAt: new Date().toISOString(),
          linkTo: "/outings",
        }).catch(() => {});
      }
    },
  });

  const completedOutings = allOutings.filter(o => o.status === "completed");

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 w-full overflow-x-hidden" data-testid="outings-page">
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/40 flex items-center justify-center flex-shrink-0">
          <MapPin size={20} className="text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{t("outings.title")}</h1>
          <p className="text-xs text-muted-foreground truncate">Outings · Location · Family updates</p>
        </div>
        <LessonLauncher pageKey="outings" />
      </div>

      {/* Family push notification panel */}
      {!isCaregiver && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-4 py-3 text-sm text-amber-800 dark:text-amber-300" data-testid="push-panel">
          📍 Push notifications are enabled — you'll be alerted when outings start and end
        </div>
      )}

      {/* Active Outing Banner */}
      {activeOuting && (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-400 dark:border-blue-700 p-4 space-y-3" data-testid="active-outing-banner">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                <MapPin size={16} className="text-white" />
              </div>
              <div>
                <div className="font-bold text-blue-800 dark:text-blue-200">Outing Active</div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  {TYPE_LABELS[activeOuting.type]} · {elapsedStr} elapsed
                  {!isCaregiver && ` · ${activeUser.name}`}
                </div>
              </div>
            </div>
            {isCaregiver && (
              <Button
                variant="outline"
                className="gap-2 border-blue-400 text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:border-blue-700"
                onClick={() => endMutation.mutate(activeOuting.id)}
                disabled={endMutation.isPending}
                data-testid="end-outing-btn"
              >
                <Square size={14} /> End Outing
              </Button>
            )}
          </div>
          {activeOuting.note && (
            <p className="text-sm text-blue-700 dark:text-blue-300 italic">{activeOuting.note}</p>
          )}
          <LeafletMap
            lat={activeOuting.lastLatitude ?? DEFAULT_LAT}
            lng={activeOuting.lastLongitude ?? DEFAULT_LNG}
            pulsing
          />
          {activeOuting.lastLocationLabel && (
            <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <MapPin size={11} /> Last known: {activeOuting.lastLocationLabel}
            </div>
          )}
        </div>
      )}

      {/* Caregiver Start Outing */}
      {isCaregiver && !activeOuting && (
        <Card className="border-border" data-testid="start-outing-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <Car size={16} /> Start an Outing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Outing Type</Label>
              <Select value={outingType} onValueChange={setOutingType}>
                <SelectTrigger data-testid="outing-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OUTING_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Where are you going? Any details for the family..."
                rows={2}
                data-testid="outing-note-input"
              />
            </div>
            <div className="rounded-lg overflow-hidden">
              <LeafletMap lat={DEFAULT_LAT} lng={DEFAULT_LNG} />
            </div>
            <p className="text-xs text-muted-foreground">📍 Location shown is simulated (Dallas, TX). In production, uses real GPS.</p>
            <Button
              className="w-full gap-2 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              data-testid="begin-outing-btn"
            >
              <Play size={15} /> Begin Outing
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Family view: no active outing */}
      {!isCaregiver && !activeOuting && (
        <Card className="border-border" data-testid="no-outing-card">
          <CardContent className="pt-8 pb-8 text-center">
            <MapPin size={40} className="mx-auto mb-3 opacity-25" />
            <p className="font-medium text-muted-foreground">No outing in progress</p>
            {completedOutings.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Last outing: {TYPE_LABELS[completedOutings[0].type]} on {new Date(completedOutings[0].startedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Outing History */}
      {completedOutings.length > 0 && (
        <div data-testid="outing-history">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Outing History</h2>
          <div className="space-y-2">
            {completedOutings.map(outing => (
              <div key={outing.id} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card" data-testid={`outing-history-${outing.id}`}>
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-sm">{TYPE_LABELS[outing.type]}</div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(outing.startedAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    {outing.durationMinutes && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={10} />
                        {outing.durationMinutes >= 60
                          ? `${Math.floor(outing.durationMinutes / 60)}h ${outing.durationMinutes % 60}m`
                          : `${outing.durationMinutes}m`}
                      </span>
                    )}
                  </div>
                  {outing.note && <p className="text-xs text-muted-foreground mt-0.5">{outing.note}</p>}
                  {outing.lastLocationLabel && (
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin size={10} /> {outing.lastLocationLabel}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
