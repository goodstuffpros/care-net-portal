import { useApp } from "@/App";
import { useLang } from "@/lib/useLang";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Client } from "@shared/schema";
import { Phone, User, AlertCircle, Pill, Heart, ShieldAlert } from "lucide-react";

const CLIENT_EMERGENCY_DATA: Record<number, {
  bloodType: string;
  dnrStatus: string;
  medications: string[];
  emergencyContacts: { name: string; relationship: string; phone: string }[];
}> = {
  1: {
    bloodType: "O+",
    dnrStatus: "No DNR on file",
    medications: [
      "Lisinopril 10mg — daily (blood pressure)",
      "Aspirin 81mg — daily (cardiac)",
      "Metformin 500mg — twice daily (diabetes)",
      "Amlodipine 5mg — daily (blood pressure)",
    ],
    emergencyContacts: [
      { name: "Robert Johnson Jr.", relationship: "Son (Main Contact)", phone: "(555) 0102" },
      { name: "Linda Johnson", relationship: "Daughter-in-law", phone: "(555) 0103" },
    ],
  },
  2: {
    bloodType: "A-",
    dnrStatus: "DNR on file — see attached order",
    medications: [
      "Carbidopa-levodopa 25/100mg — 3× daily (Parkinson's)",
      "Metformin 1000mg — twice daily (diabetes)",
      "Insulin glargine 20 units — nightly",
    ],
    emergencyContacts: [
      { name: "Sarah Williams", relationship: "Daughter (Main Contact)", phone: "(555) 0104" },
      { name: "Tom Williams", relationship: "Son-in-law", phone: "(555) 0105" },
    ],
  },
  3: {
    bloodType: "B+",
    dnrStatus: "Unknown — consult family",
    medications: [
      "Ibuprofen (prescribed) 400mg — as needed (arthritis, NSAID-sensitive — verify dose)",
      "Aspirin 81mg — daily",
    ],
    emergencyContacts: [
      { name: "Maria Garcia", relationship: "Daughter (Facilitator)", phone: "(555) 0112" },
      { name: "James Garcia", relationship: "Son", phone: "(555) 0113" },
    ],
  },
};

export default function EmergencyPage() {
  const { selectedClientId } = useApp();
  const { t } = useLang();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("GET", "/api/clients").then(r => r.json()),
  });
  const client = clients.find(c => c.id === selectedClientId);
  const emergencyData = CLIENT_EMERGENCY_DATA[selectedClientId] || CLIENT_EMERGENCY_DATA[1];
  const allergies: string[] = client?.allergies ? JSON.parse(client.allergies) : [];
  const isDnrWarning = emergencyData.dnrStatus.toLowerCase().includes("dnr on file") || emergencyData.dnrStatus.toLowerCase().includes("unknown");

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
              {emergencyData.bloodType}
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
      <div className={`rounded-xl border-2 p-4 flex items-center gap-3 ${isDnrWarning ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"}`}>
        <Heart size={24} className={isDnrWarning ? "text-amber-600" : "text-emerald-600"} />
        <div>
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">DNR Status</div>
          <div className="text-lg font-bold">{emergencyData.dnrStatus}</div>
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
        <div className="space-y-2">
          {emergencyData.medications.map((med, i) => (
            <div key={i} className="flex items-start gap-2 text-lg">
              <span className="w-2 h-2 rounded-full bg-purple-500 mt-2.5 flex-shrink-0" />
              <span>{med}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="rounded-xl border-2 border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Phone size={20} className="text-blue-600" />
          <div className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Emergency Contacts
          </div>
        </div>
        <div className="space-y-3">
          {emergencyData.emergencyContacts.map((contact, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <div>
                <div className="text-lg font-semibold">{contact.name}</div>
                <div className="text-muted-foreground">{contact.relationship}</div>
              </div>
              <div className="text-xl font-bold text-primary">{contact.phone}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Primary Physician */}
      <div className="rounded-xl border-2 border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <User size={20} className="text-teal-600" />
          <div className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Primary Physician
          </div>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
          <div>
            <div className="text-lg font-semibold">Dr. Richard Chen</div>
            <div className="text-muted-foreground">Neurologist</div>
          </div>
          <div className="text-xl font-bold text-primary">(555) 0200</div>
        </div>
      </div>
    </div>
  );
}
