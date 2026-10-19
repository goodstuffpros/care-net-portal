import jsPDF from "jspdf";

// ── Types shared with the Visit Report page ────────────────────────────────
export interface VisitEntry {
  id: number;
  title: string;
  description: string;
  notes: string;
  priority: string;
  category: string;
  loggedAt: string;
  loggedByName: string;
  loggedByRole: string | null;
  isEmergency: boolean;
  emergencyType: string | null;
  corrections: { correctedText: string; createdAt: string }[];
  addenda: { tag: string; note: string; createdAt: string }[];
}
export interface VisitMedication {
  id: number; name: string; generic_name?: string; dosage_amount?: number; dosage_unit?: string; strength?: string;
  schedule_type?: string; frequency?: string; frequency_note?: string; purpose?: string; instructions?: string;
  prescribing_physician?: string; status: string; start_date?: string; discontinued_date?: string; discontinued_reason?: string;
}
export interface VisitHistory {
  id: number; entry_type: string; title: string; date_approx?: string; date_year?: number; date_month?: number; date_day?: number;
  facility?: string; provider?: string; outcome?: string; notes?: string; is_significant?: number | boolean;
}
export interface VisitReportInput {
  client: { name: string; dateOfBirth?: string | null; primaryCondition?: string | null; allergies?: string | null; diagnoses?: string | null };
  preparedBy: { name: string; role: string };
  visitWith: string;
  visitReason: string;
  periodLabel: string;
  entries: VisitEntry[];
  questions: string[];
  medications: VisitMedication[] | null;   // null = section turned off
  healthHistory: VisitHistory[] | null;    // null = section turned off
}

// ── Helpers ────────────────────────────────────────────────────────────────
// Built-in PDF fonts only cover basic Latin characters. Normalize everything else
// so emojis or smart quotes never break the document.
export function clean(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A1-\u00FF]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export const ROLE_NAMES: Record<string, string> = {
  self_care: "Self", primary_family: "Main Contact", secondary_family: "Family",
  caregiver: "Caregiver", multi_caregiver: "Caregiver", temp_caregiver: "Temp Caregiver", facilitator: "Facilitator",
};
export const CATEGORY_NAMES: Record<string, string> = {
  medication: "Medication", hygiene: "Hygiene", meal: "Meals", mood: "Mood", medical: "Medical", general: "General",
};
export const HISTORY_TYPE_NAMES: Record<string, string> = {
  surgery: "Surgery", diagnosis: "Diagnosis", hospitalization: "Hospitalization", injury: "Injury",
  treatment: "Treatment", medication_start: "Medication started", allergy_discovered: "Allergy found", other: "Other",
};
export const ADDENDUM_NAMES: Record<string, string> = {
  typo: "Spelling fix", incomplete: "Added detail", wrong_data: "Correction", additional_detail: "Added detail", timing_correction: "Time correction",
};
const FREQ: Record<string, string> = {
  once_daily: "once daily", twice_daily: "twice daily", three_daily: "3x daily", four_daily: "4x daily",
  weekly: "weekly", biweekly: "every 2 weeks", monthly: "monthly", other: "",
};

export function priorityLabel(p: string): string {
  if (p === "red") return "Urgent";
  if (p === "yellow") return "Concern";
  return "";
}
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}
export function historyDate(h: VisitHistory): string {
  if (h.date_year && h.date_month) {
    return new Date(h.date_year, h.date_month - 1, h.date_day || 1).toLocaleDateString([], { month: "short", ...(h.date_day ? { day: "numeric" } : {}), year: "numeric" });
  }
  return h.date_approx || (h.date_year ? String(h.date_year) : "");
}
export function medLine(m: VisitMedication): string {
  const dose = [m.dosage_amount != null ? `${m.dosage_amount}${m.dosage_unit ?? ""}` : "", m.strength ? `(${m.strength})` : ""].filter(Boolean).join(" ");
  const how = m.schedule_type === "as_needed" ? "as needed" : (FREQ[m.frequency ?? ""] ?? m.frequency ?? "");
  return [m.name, dose, how, m.frequency_note].filter(Boolean).join(" - ");
}
function parseList(json?: string | null): string[] {
  try {
    const arr = JSON.parse(json ?? "[]");
    if (!Array.isArray(arr)) return [];
    return arr.map((a: any) => (typeof a === "string" ? a : [String(a.name ?? "").trim(), a.severity ? `(${a.severity})` : "", a.reaction ? `- ${a.reaction}` : ""].filter(Boolean).join(" ")).trim()).filter(Boolean);
  } catch { return []; }
}

// ── PDF builder ────────────────────────────────────────────────────────────
export function buildVisitReportPDF(input: VisitReportInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  const bottom = pageH - 56; // leave room for footer
  const teal: [number, number, number] = [26, 110, 100];
  const ink: [number, number, number] = [25, 28, 35];
  const muted: [number, number, number] = [105, 115, 125];
  const amber: [number, number, number] = [150, 85, 10];
  const red: [number, number, number] = [160, 40, 50];
  let y = margin;

  const ensure = (h: number) => { if (y + h > bottom) { doc.addPage(); y = margin; } };
  const text = (s: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? ink));
    const lines = doc.splitTextToSize(clean(s), contentW - indent) as string[];
    const lh = size * 1.35;
    for (const line of lines) { ensure(lh); doc.text(line, margin + indent, y + size); y += lh; }
    y += opts.gap ?? 0;
  };
  const heading = (s: string) => {
    ensure(40);
    y += 10;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...teal);
    doc.text(s.toUpperCase(), margin, y + 12);
    y += 18;
    doc.setDrawColor(215, 222, 228); doc.line(margin, y, pageW - margin, y);
    y += 8;
  };

  // Header band
  doc.setFillColor(...teal);
  doc.rect(0, 0, pageW, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("Doctor Visit Report", margin, 30);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  doc.text("Prepared with Care Net Portal", margin, 47);
  doc.text(`Created ${fmtDate(new Date().toISOString())}`, pageW - margin, 47, { align: "right" });
  y = 84;

  // Patient block
  const dob = input.client.dateOfBirth ? fmtDate(input.client.dateOfBirth + (input.client.dateOfBirth.length === 10 ? "T12:00:00" : "")) : "";
  text(input.client.name, { size: 15, bold: true, gap: 2 });
  const facts = [
    dob && `Date of birth: ${dob}`,
    input.client.primaryCondition && `Condition: ${input.client.primaryCondition}`,
  ].filter(Boolean).join("   |   ");
  if (facts) text(facts, { size: 10, color: muted, gap: 2 });
  const allergies = parseList(input.client.allergies);
  text(`Allergies: ${allergies.length ? allergies.join("; ") : "None recorded"}`, { size: 10, color: allergies.length ? red : muted, bold: allergies.length > 0, gap: 2 });
  const diagnoses = parseList(input.client.diagnoses);
  if (diagnoses.length) text(`Diagnoses: ${diagnoses.join("; ")}`, { size: 10, color: muted, gap: 2 });
  y += 4;
  text(`Report period: ${input.periodLabel}`, { size: 10.5, bold: true, gap: 2 });
  if (input.visitWith) text(`Visit with: ${input.visitWith}`, { size: 10, gap: 2 });
  if (input.visitReason) text(`Reason for visit: ${input.visitReason}`, { size: 10, gap: 2 });
  text(`Prepared by: ${input.preparedBy.name}${ROLE_NAMES[input.preparedBy.role] ? ` (${ROLE_NAMES[input.preparedBy.role]})` : ""}`, { size: 10, color: muted });

  // At a glance
  const entries = input.entries;
  const concerns = entries.filter(e => e.priority === "yellow" || e.priority === "red");
  const emergencies = entries.filter(e => e.isEmergency);
  const byCat = new Map<string, number>();
  for (const e of entries) byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
  heading("At a glance");
  text(`${entries.length} care log ${entries.length === 1 ? "entry" : "entries"}   |   ${concerns.length} marked as a concern or urgent   |   ${emergencies.length} emergency ${emergencies.length === 1 ? "event" : "events"}`, { size: 10.5, gap: 2 });
  if (byCat.size) text("By type: " + Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${CATEGORY_NAMES[c] ?? c} ${n}`).join(", "), { size: 10, color: muted });

  // Questions
  if (input.questions.length) {
    heading("Questions for the doctor");
    input.questions.forEach((q, i) => text(`${i + 1}.  ${q}`, { size: 10.5, indent: 4, gap: 3 }));
  }

  // Concerns
  if (concerns.length || emergencies.length) {
    heading("Concerns in this period");
    const list = Array.from(new Map([...emergencies, ...concerns].map(e => [e.id, e] as [number, VisitEntry])).values())
      .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
    for (const e of list) {
      const tag = e.isEmergency ? "Emergency" : priorityLabel(e.priority);
      const flat = (e.description ?? "").replace(/\s+/g, " ").trim();
      const summary = flat ? ` - ${flat.length > 140 ? flat.slice(0, 137).trimEnd() + "..." : flat}` : "";
      text(`${fmtDate(e.loggedAt)}  [${tag}]  ${e.title.trim()}${summary}`, { size: 10, indent: 4, gap: 2, color: e.priority === "red" || e.isEmergency ? red : ink });
    }
    text("Full details for each entry are in the timeline that follows.", { size: 9, color: muted });
  }

  // Medications
  if (input.medications) {
    heading("Medications");
    const active = input.medications.filter(m => m.status === "active");
    const stopped = input.medications.filter(m => m.status !== "active");
    if (!active.length && !stopped.length) text("No medications recorded.", { size: 10, color: muted });
    for (const m of active) {
      text(medLine(m), { size: 10.5, bold: true, indent: 4 });
      const sub = [m.purpose && `For: ${m.purpose}`, m.prescribing_physician && `Prescribed by: ${m.prescribing_physician}`, m.start_date && `Started: ${fmtDate(m.start_date + "T12:00:00")}`].filter(Boolean).join("  |  ");
      if (sub) text(sub, { size: 9.5, color: muted, indent: 14 });
      y += 3;
    }
    if (stopped.length) {
      text("Stopped during this period:", { size: 10, bold: true, indent: 4, gap: 1 });
      for (const m of stopped) text(`${medLine(m)}${m.discontinued_date ? ` - stopped ${fmtDate(m.discontinued_date + "T12:00:00")}` : ""}${m.discontinued_reason ? ` (${m.discontinued_reason.replace(/_/g, " ")})` : ""}`, { size: 10, indent: 14 });
    }
  }

  // Health history
  if (input.healthHistory && input.healthHistory.length) {
    heading("Health history");
    for (const h of input.healthHistory) {
      const when = historyDate(h);
      text(`${when ? when + "  " : ""}${HISTORY_TYPE_NAMES[h.entry_type] ?? h.entry_type}: ${h.title}`, { size: 10.5, bold: !!h.is_significant, indent: 4 });
      const sub = [h.provider, h.facility, h.outcome].filter(Boolean).join("  |  ");
      if (sub) text(sub, { size: 9.5, color: muted, indent: 14 });
      y += 2;
    }
  }

  // Timeline
  if (entries.length) {
    doc.addPage(); y = margin;
    heading(`Day-by-day care log (${entries.length})`);
    let lastDay = "";
    for (const e of [...entries].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))) {
      const day = new Date(e.loggedAt).toDateString();
      if (day !== lastDay) {
        ensure(70); // keep the date heading with its first entry
        y += 6;
        text(new Date(e.loggedAt).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" }), { size: 10.5, bold: true, color: teal, gap: 2 });
        lastDay = day;
      }
      ensure(36);
      const time = new Date(e.loggedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const tag = e.isEmergency ? `Emergency${e.emergencyType ? ` (${e.emergencyType.replace(/_/g, " ")})` : ""}` : priorityLabel(e.priority);
      text(`${time}   ${e.title}${tag ? `   [${tag}]` : ""}`, { size: 10.5, bold: true, indent: 4, color: e.priority === "red" || e.isEmergency ? red : e.priority === "yellow" ? amber : ink });
      if (e.description) text(e.description, { size: 10, indent: 14 });
      if (e.notes) text(`Notes: ${e.notes}`, { size: 10, indent: 14 });
      for (const c of e.corrections) if (c.correctedText) text(`Corrected: ${c.correctedText}`, { size: 9.5, indent: 14 });
      for (const a of e.addenda) text(`Added ${fmtDate(a.createdAt)} (${ADDENDUM_NAMES[a.tag] ?? "Note"}): ${a.note}`, { size: 9.5, indent: 14, color: muted });
      text(`Logged by ${e.loggedByName}${e.loggedByRole && ROLE_NAMES[e.loggedByRole] ? ` (${ROLE_NAMES[e.loggedByRole]})` : ""}  |  ${CATEGORY_NAMES[e.category] ?? e.category}`, { size: 8.5, indent: 14, color: muted, gap: 6 });
    }
  }

  // Footer on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(215, 222, 228);
    doc.line(margin, pageH - 40, pageW - margin, pageH - 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text(clean(`${input.client.name} - reported by the patient and family, not a medical record. Prepared by ${input.preparedBy.name} via Care Net Portal.`), margin, pageH - 26, { maxWidth: contentW - 60 });
    doc.text(`Page ${i} of ${total}`, pageW - margin, pageH - 26, { align: "right" });
  }
  return doc;
}

export function visitReportFileName(clientName: string) {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${clean(clientName).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "Patient"}-Visit-Report-${stamp}.pdf`;
}
