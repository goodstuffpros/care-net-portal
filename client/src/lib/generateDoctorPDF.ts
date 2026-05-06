import jsPDF from "jspdf";
import type { ArchiveSummary } from "@shared/schema";
import type { Client } from "@shared/schema";

export function generateDoctorPDF(summary: ArchiveSummary, client: Client) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = margin;

  const teal = [26, 110, 100] as const;       // brand primary
  const slate = [60, 75, 90] as const;
  const muted = [120, 135, 150] as const;
  const black = [20, 20, 30] as const;

  // ── Header bar ──────────────────────────────────────────────
  doc.setFillColor(...teal);
  doc.rect(0, 0, pageW, 68, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Care Net Portal", margin, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Clinical Care Summary — For Healthcare Provider Use", margin, 48);

  const generated = new Date(summary.generatedAt).toLocaleDateString([], {
    month: "long", day: "numeric", year: "numeric",
  });
  doc.text(`Generated: ${generated}`, pageW - margin, 48, { align: "right" });

  y = 92;

  // ── Patient info block ───────────────────────────────────────
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, contentW, 88, 6, 6, "F");
  doc.setDrawColor(220, 228, 236);
  doc.roundedRect(margin, y, contentW, 88, 6, 6, "S");

  const dob = client.dateOfBirth
    ? new Date(client.dateOfBirth).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })
    : "Not on file";

  const allergies: string[] = (() => {
    try { return JSON.parse(client.allergies ?? "[]"); } catch { return []; }
  })();

  const col1x = margin + 16;
  const col2x = margin + contentW / 2;
  let infoY = y + 22;

  const field = (label: string, value: string, x: number, fy: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(label.toUpperCase(), x, fy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...black);
    doc.text(value || "—", x, fy + 14);
  };

  field("Patient Name", client.name, col1x, infoY);
  field("Date of Birth", dob, col2x, infoY);
  infoY += 36;
  field("Primary Condition", client.primaryCondition ?? "Not on file", col1x, infoY);
  field("Known Allergies", allergies.length ? allergies.join(", ") : "NKDA", col2x, infoY);

  y += 104;

  // ── Section: Clinical Summary ────────────────────────────────
  const drawSectionTitle = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...teal);
    doc.text(title, margin, y);
    doc.setDrawColor(...teal);
    doc.setLineWidth(1);
    doc.line(margin, y + 4, margin + contentW, y + 4);
    y += 20;
  };

  // Period label pill
  doc.setFillColor(...teal);
  doc.roundedRect(margin, y, 110, 20, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`30-DAY SUMMARY — ${summary.periodLabel.toUpperCase()}`, margin + 8, y + 13);
  y += 32;

  drawSectionTitle("Clinical Narrative");

  const clinicalText = summary.summaryTextMedical ?? summary.summaryText;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...slate);

  const lines = doc.splitTextToSize(clinicalText, contentW);
  // Paginate if needed
  lines.forEach((line: string) => {
    if (y > pageH - 80) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 14;
  });

  y += 12;

  // ── Section: Highlights ──────────────────────────────────────
  const highlights: string[] = (() => {
    try { return JSON.parse(summary.highlights ?? "[]"); } catch { return []; }
  })();

  if (highlights.length > 0) {
    if (y > pageH - 120) { doc.addPage(); y = margin; }
    drawSectionTitle("Key Care Indicators");

    const colW = (contentW - 12) / 2;
    highlights.forEach((h, i) => {
      const col = i % 2 === 0 ? margin : margin + colW + 12;
      if (i % 2 === 0 && i > 0) y += 22;
      if (i === 0) { /* first item, y already set */ }

      // Pill background
      doc.setFillColor(240, 248, 246);
      doc.setDrawColor(180, 220, 215);
      doc.roundedRect(col, y, colW, 20, 4, 4, "FD");

      // Dot
      doc.setFillColor(...teal);
      doc.circle(col + 12, y + 10, 3, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...black);
      doc.text(h, col + 22, y + 13.5);
    });

    y += 32;
  }

  // ── Section: Provider Notes space ───────────────────────────
  if (y > pageH - 140) { doc.addPage(); y = margin; }
  drawSectionTitle("Provider Notes");

  doc.setDrawColor(210, 218, 226);
  doc.setLineWidth(0.5);
  for (let i = 0; i < 4; i++) {
    doc.line(margin, y + i * 22, margin + contentW, y + i * 22);
  }
  y += 100;

  // ── Footer ───────────────────────────────────────────────────
  const footerY = pageH - 36;
  doc.setDrawColor(220, 228, 236);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 10, margin + contentW, footerY - 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(
    "This document was generated by Care Net Portal for clinical communication purposes only. Not a substitute for professional medical records.",
    margin, footerY, { maxWidth: contentW - 80 }
  );
  doc.text(
    `Page 1  ·  carenetportal.com`,
    pageW - margin, footerY, { align: "right" }
  );

  // ── Download ─────────────────────────────────────────────────
  const safeName = client.name.replace(/\s+/g, "_");
  const periodSlug = summary.periodLabel.replace(/\s+/g, "_").replace(/,/g, "");
  doc.save(`CareNet_ClinicalBrief_${safeName}_${periodSlug}.pdf`);
}
