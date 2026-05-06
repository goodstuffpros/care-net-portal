/**
 * Care Net Portal — Print Utilities
 * Generates print-friendly HTML for various content types.
 * Opens in a new window and triggers the browser print dialog.
 */

export interface PrintableEvent {
  title: string;
  type: string;
  scheduledAt: string;
  notes?: string | null;
  location?: string | null;
  recurrence?: string | null;
  priority: string;
  isCompleted: boolean;
}

export interface PrintableLog {
  title: string;
  description?: string | null;
  category: string;
  priority: string;
  loggedAt: string;
}

function priorityLabel(p: string) {
  return p === "red" ? "URGENT" : p === "yellow" ? "IMPORTANT" : "Normal";
}

function priorityColor(p: string) {
  return p === "red" ? "#dc2626" : p === "yellow" ? "#d97706" : "#059669";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString([], { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function printHTML(title: string, bodyHtml: string, clientName: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <title>${title} — Care Net Portal</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; background: white; padding: 32px 40px; max-width: 800px; margin: 0 auto; }
        .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #217a72; padding-bottom: 16px; margin-bottom: 24px; }
        .logo { font-family: Arial, sans-serif; font-size: 22px; font-weight: 800; color: #217a72; }
        .logo span { color: #1a1a1a; font-weight: 400; font-size: 14px; display: block; margin-top: 2px; }
        .meta { text-align: right; font-size: 12px; color: #666; }
        h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        h2 { font-size: 14px; font-weight: 600; color: #444; margin: 20px 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
        .card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px 16px; margin-bottom: 10px; page-break-inside: avoid; }
        .card-title { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
        .card-detail { font-size: 12px; color: #555; margin-bottom: 4px; display: flex; gap: 8px; }
        .card-detail strong { color: #333; min-width: 90px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; font-family: Arial, sans-serif; border: 1px solid; }
        .priority-red { color: #dc2626; border-color: #fca5a5; background: #fef2f2; }
        .priority-yellow { color: #d97706; border-color: #fcd34d; background: #fffbeb; }
        .priority-green { color: #059669; border-color: #6ee7b7; background: #f0fdf4; }
        .allergy-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .allergy { padding: 3px 10px; border-radius: 999px; border: 1px solid #fca5a5; background: #fef2f2; color: #dc2626; font-size: 11px; font-weight: 600; }
        .notice { font-size: 11px; color: #888; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px; font-style: italic; }
        .checked { text-decoration: line-through; color: #888; }
        @media print {
          body { padding: 20px; }
          .no-print { display: none; }
        }
        .print-btn { font-family: Arial, sans-serif; background: #217a72; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:16px">
        <button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
      </div>
      <div class="header">
        <div>
          <div class="logo">Care Net Portal <span>Printed Care Document</span></div>
          <h1>${title}</h1>
          <div style="font-size:12px;color:#666;margin-top:4px">Client: <strong>${clientName}</strong></div>
        </div>
        <div class="meta">
          Printed on ${new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}<br/>
          ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </div>
      </div>
      ${bodyHtml}
      <div class="notice">This document was generated from Care Net Portal. For medical emergencies, call 911. Information is current as of the print date above.</div>
    </body>
    </html>
  `);
  win.document.close();
}

export function printMedications(events: PrintableEvent[], clientName: string, allergies: string[]) {
  const meds = events.filter(e => e.type === "medication");
  let body = `<h2>Medication Schedule</h2>`;

  if (allergies.length > 0) {
    body += `
      <div class="card" style="border-color:#fca5a5;background:#fef2f2;">
        <div class="card-title" style="color:#dc2626;">⚠ Known Allergies & Contraindications</div>
        <div class="allergy-list">${allergies.map(a => `<span class="allergy">${a}</span>`).join("")}</div>
      </div>`;
  }

  if (meds.length === 0) {
    body += `<p style="color:#888;font-size:13px;padding:16px 0;">No medications scheduled.</p>`;
  } else {
    meds.forEach(e => {
      body += `
        <div class="card">
          <div class="card-title ${e.isCompleted ? 'checked' : ''}">${e.title}</div>
          <div class="card-detail"><strong>Scheduled:</strong> ${formatDate(e.scheduledAt)}</div>
          ${e.recurrence && e.recurrence !== "none" ? `<div class="card-detail"><strong>Frequency:</strong> ${e.recurrence.charAt(0).toUpperCase() + e.recurrence.slice(1)}</div>` : ""}
          ${e.notes ? `<div class="card-detail"><strong>Instructions:</strong> ${e.notes}</div>` : ""}
          <div class="card-detail"><strong>Priority:</strong> <span class="badge priority-${e.priority}">${priorityLabel(e.priority)}</span></div>
          ${e.isCompleted ? `<div class="card-detail" style="color:#059669;margin-top:6px;"><strong>✓ Completed</strong></div>` : ""}
        </div>`;
    });
  }

  printHTML("Medication Schedule", body, clientName);
}

export function printSchedule(events: PrintableEvent[], clientName: string) {
  let body = `<h2>Full Schedule</h2>`;
  const sorted = [...events].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  if (sorted.length === 0) {
    body += `<p style="color:#888;font-size:13px;padding:16px 0;">No scheduled events.</p>`;
  } else {
    sorted.forEach(e => {
      body += `
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <div class="card-title ${e.isCompleted ? 'checked' : ''}">${e.title}</div>
            <span class="badge priority-${e.priority}">${priorityLabel(e.priority)}</span>
          </div>
          <div class="card-detail"><strong>Date & Time:</strong> ${formatDate(e.scheduledAt)}</div>
          <div class="card-detail"><strong>Type:</strong> ${e.type.charAt(0).toUpperCase() + e.type.slice(1)}</div>
          ${e.location ? `<div class="card-detail"><strong>Location:</strong> ${e.location}</div>` : ""}
          ${e.recurrence && e.recurrence !== "none" ? `<div class="card-detail"><strong>Recurrence:</strong> ${e.recurrence}</div>` : ""}
          ${e.notes ? `<div class="card-detail"><strong>Notes:</strong> ${e.notes}</div>` : ""}
          ${e.isCompleted ? `<div style="color:#059669;font-size:11px;margin-top:6px;font-weight:700;">✓ COMPLETED</div>` : ""}
        </div>`;
    });
  }

  printHTML("Schedule", body, clientName);
}

export function printActivityLog(logs: PrintableLog[], clientName: string) {
  let body = `<h2>Care Log</h2>`;

  if (logs.length === 0) {
    body += `<p style="color:#888;font-size:13px;padding:16px 0;">No activity logged.</p>`;
  } else {
    logs.forEach(log => {
      body += `
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <div class="card-title">${log.title}</div>
            <span class="badge priority-${log.priority}">${priorityLabel(log.priority)}</span>
          </div>
          ${log.description ? `<div class="card-detail" style="font-size:13px;color:#333;margin-bottom:8px;line-height:1.5;">${log.description}</div>` : ""}
          <div class="card-detail"><strong>Category:</strong> ${log.category.charAt(0).toUpperCase() + log.category.slice(1)}</div>
          <div class="card-detail"><strong>Logged:</strong> ${new Date(log.loggedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
        </div>`;
    });
  }

  printHTML("Care Log", body, clientName);
}
