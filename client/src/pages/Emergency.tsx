import { useApp } from "@/App";
import { useLang } from "@/lib/useLang";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Client, Medication } from "@shared/schema";
import { Phone, User, AlertCircle, Pill, Heart, ShieldAlert } from "lucide-react";

export default function EmergencyPage() {
  const { selectedClientId, activeUser } = useApp();
  const { t } = useLang();

  // Client record
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("GET", "/api/clients").then(r => r.json()),
  });
  const client = clients.find(c => c.id === selectedClientId);

  // Real medications from DB
  const { data: medications = [] } = useQuery<Medication[]>({
    queryKey: ["/api/clients", selectedClientId, "medications"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/medications`).then(r => r.json()),
    enabled: !!selectedClientId,
  });

  // Care team (for emergency contacts)
  const { data: careTeam = [] } = useQuery<any[]>({
    queryKey: ["/api/clients", selectedClientId, "care-team"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/care-team`).then(r => r.json()),
    enabled: !!selectedClientId,
  });

  // Allergies from client record
  const allergies: string[] = client?.allergies
    ? JSON.parse(client.allergies).map((a: any) => typeof a === "string" ? a : a?.name ?? "")
    : [];

  // Active medications only, formatted for display
  const activeMeds = medications.filter(m => m.isActive !== false);

  // Care team members as emergency contacts (MC first, then others)
  const emergencyContacts = careTeam
    .filter(m => m.role === "primary_family" || m.role === "secondary_family" || m.role === "caregiver")
    .map(m => ({
      name: m.name,
      relationship: m.role === "primary_family" ? "Main Contact" : m.role === "secondary_family" ? "Family Member" : "Caregiver",
      phone: m.phone || "—",
    }));

  const dnrStatus = "Not on file — consult family";
  const isDnrWarning = true;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5" data-testid="emergency-page">
      {/* Red Banner */}
      <div className="rounded-xl bg-red-600 text-white px-6 py-4 flex items-center gap-3">
        <ShieldAlert size={28} className="flex-shrink-0" />
        <div>
          <div className="text-lg font-bold tracking-wide">🚨 EMERGENCY INFORMATION</div>
          <div className="text-sm text-red-100 mt-0.5">Show this screen to first responders</div>
        </div>
      </div>

      {/* Client Identity */}
      <div className="rounded-xl border-2 border-border bg-card p-5 space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User size={24} className="text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              {client?.name || "Loading..."}
            </div>
            <div className="text-lg text-muted-foreground">
              DOB: {client?.dateOfBirth ? new Date(client.dateOfBirth + "T00:00:00").toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : "—"}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-sm text-muted-foreground">Blood Type</div>
            <div className="text-2xl font-bold text-red-600" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              Not on file
            </div>
          </div>
        </div>
        {client?.primaryCondition && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Primary Condition</div>
            <div className="text-lg font-medium">{client.primaryCondition}</div>
          </div>
        )}
      </div>

      {/* DNR Status */}
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-center gap-3">
        <Heart size={24} className="text-amber-600" />
        <div>
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">DNR Status</div>
          <div className="text-lg font-bold">{dnrStatus}</div>
        </div>
      </div>

      {/* Allergies */}
      <div className="rounded-xl border-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={20} className="text-red-600" />
          <div className="text-xl font-bold text-red-800 dark:text-red-300" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            ALLERGIES
          </div>
        </div>
        {allergies.length === 0 ? (
          <div className="text-lg text-muted-foreground">No known allergies on file</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allergies.map(a => (
              <span key={a} className="px-4 py-2 rounded-full bg-red-600 text-white text-lg font-bold">
                {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Current Medications */}
      <div className="rounded-xl border-2 border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Pill size={20} className="text-purple-600" />
          <div className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Current Medications
          </div>
        </div>
        {activeMeds.length === 0 ? (
          <div className="text-lg text-muted-foreground">No medications on file</div>
        ) : (
          <div className="space-y-2">
            {activeMeds.map(med => (
              <div key={med.id} className="flex items-start gap-2 text-lg">
                <span className="w-2 h-2 rounded-full bg-purple-500 mt-2.5 flex-shrink-0" />
                <span>
                  {med.name} {med.dosage ? `${med.dosage}` : ""}
                  {med.frequency ? ` — ${med.frequency}` : ""}
                  {med.purpose ? ` (${med.purpose})` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emergency Contacts */}
      <div className="rounded-xl border-2 border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Phone size={20} className="text-blue-600" />
          <div className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Emergency Contacts
          </div>
        </div>
        {emergencyContacts.length === 0 ? (
          <div className="text-lg text-muted-foreground">No contacts on file</div>
        ) : (
          <div className="space-y-3">
            {emergencyContacts.map((contact, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <div>
                  <div className="text-lg font-semibold">{contact.name}</div>
                  <div className="text-muted-foreground">{contact.relationship}</div>
                </div>
                <div className="text-xl font-bold text-primary">{contact.phone}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
