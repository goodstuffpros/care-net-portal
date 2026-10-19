import jsPDF from "jspdf";
import type { ArchiveSummary, Client } from "@shared/schema";
import { clean } from "@/lib/generateVisitReportPDF";

function parseList(json?: string | null): string[] {
  try {
    const arr = JSON.parse(json ?? "[]");
    if (!Array.isArray(arr)) return [];
    return arr.map((a: any) => (typeof a === "string" ? a : [String(a.name ?? "").trim(), a.severity ? `(${a.severity})` : ""].filter(Boolean).join(" ")).trim()).filter(Boolean);
  } catch { return []; }
}

const SECTION_LABELS = ["Reported concerns:", "Course over period:", "Medications:", "Vitals:", "Recent history:"];

export function generateMedicalSummaryPDF(summary: ArchiveSummary, client: Client) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  const bottom = pageH - 60;
  const teal: [number, number, number] = [26, 110, 100];
  const ink: [number, number, number] = [25, 28, 35];
  const muted: [number, number, number] = [105, 115, 125];
  const red: [number, number, number] = [160, 40, 50];
  let y = margin;

  const ensure = (h: number) => { if (y + h > bottom) { doc.addPage(); y = margin; } };
  const text = (s: string, o: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number; gap?: number } = {}) => {
    const size = o.size ?? 10.5;
    doc.setFont("helvetica", o.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(o.color ?? ink));
    const lines = doc.splitTextToSize(clean(s), contentW - (o.indent ?? 0)) as string[];
    for (const line of lines) { ensure(size * 1.4); doc.text(line, margin + (o.indent ?? 0), y + size); y += size * 1.4; }
    y += o.gap ?? 0;
  };
  const heading = (s: string) => {
    ensure(40); y += 10;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.setTextColor(...teal);
    doc.text(s.toUpperCase(), margin, y + 12); y += 18;
    doc.setDrawColor(215, 222, 228); doc.line(margin, y, pageW - margin, y); y += 8;
  };

  // Header
  doc.setFillColor(...teal); doc.rect(0, 0, pageW, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("Care Summary for Healthcare Provider", margin, 30);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  doc.text("Prepared with Care Net Portal", margin, 47);
  doc.text(`Created ${new Date(summary.generatedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`, pageW - margin, 47, { align: "right" });
  y = 84;

  // Patient
  text(client.name, { size: 15, bold: true, gap: 2 });
  const dob = client.dateOfBirth ? new Date(client.dateOfBirth + (client.dateOfBirth.length === 10 ? "T12:00:00" : "")).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "";
  const facts = [dob && `Date of birth: ${dob}`, client.primaryCondition && `Condition: ${client.primaryCondition}`].filter(Boolean).join("   |   ");
  if (facts) text(facts, { size: 10, color: muted, gap: 2 });
  const allergies = parseList(client.allergies);
  text(`Allergies: ${allergies.length ? allergies.join("; ") : "None recorded"}`, { size: 10, bold: allergies.length > 0, color: allergies.length ? red : muted, gap: 2 });
  const dx = parseList(client.diagnoses);
  if (dx.length) text(`Diagnoses: ${dx.join("; ")}`, { size: 10, color: muted, gap: 2 });
  text(`Reporting period: ${summary.periodLabel}`, { size: 10.5, bold: true, gap: 2 });

  // Medical narrative — split off the "Based on…" line
  const [body, ...rest] = (summary.summaryTextMedical || summary.summaryText).split(/\n\n(?=Based on )/);
  heading("Clinical summary");
  for (const para of body.split(/\n+/)) {
    const p = para.trim();
    if (!p) continue;
    const label = SECTION_LABELS.find(l => p.startsWith(l));
    if (label) {
      text(label.replace(":", ""), { size: 10.5, bold: true, color: teal, gap: 1 });
      const after = p.slice(label.length).trim();
      if (after) text(after, { size: 10.5, gap: 5 });
    } else {
      text(p, { size: 10.5, gap: 5 });
    }
  }

  const highlights: string[] = (() => { try { return JSON.parse(summary.highlights ?? "[]"); } catch { return []; } })();
  if (highlights.length) {
    heading("Key points");
    for (const h of highlights) text(`-  ${h}`, { size: 10.5, indent: 4, gap: 2 });
  }

  heading("About this summary");
  text(rest.join(" ") || "Written by AI from the portal's records. Reported by the patient, family, and caregivers; not a medical record.", { size: 9.5, color: muted, gap: 2 });
  text("For the full day-by-day detail, ask the family for a Doctor Visit Report from Care Net Portal.", { size: 9.5, color: muted });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(215, 222, 228); doc.line(margin, pageH - 40, pageW - margin, pageH - 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text(clean(`${client.name} - reported by the patient, family, and caregivers; not a medical record. Care Net Portal.`), margin, pageH - 26, { maxWidth: contentW - 60 });
    doc.text(`Page ${i} of ${total}`, pageW - margin, pageH - 26, { align: "right" });
  }
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  doc.save(`${clean(client.name).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "Patient"}-Care-Summary-${stamp}.pdf`);
}
