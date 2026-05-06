/**
 * Care Net Portal — Pattern Recognition Engine
 *
 * Two responsibilities:
 *  1. Auto-tagger: when a care log entry is saved, extract structured tags
 *     (symptom, activity, food, sleep, mood) using keyword matching + severity scoring.
 *     In production this would call a lightweight LLM; here we use a fast keyword
 *     dictionary that covers the most clinically relevant terms.
 *
 *  2. Pattern engine: runs on a schedule (or on-demand), correlates observation tags
 *     with medication administration timestamps, and detects patterns that cross
 *     the two threshold tracks:
 *       Track A — consecutive days: 3-day soft alert, 7-day escalation prompt
 *       Track B — semi-regular:     3×/week soft alert, 6×/2-weeks escalation prompt
 *
 *  Alerting philosophy:
 *   - Only severe/moderate symptoms trigger push notifications.
 *   - Mild observations surface quietly in weekly/monthly summaries only.
 *   - The CG is always framed as the reason the pattern was caught.
 *   - Language centers on what the CLIENT is experiencing — never on CG action.
 *   - Every alert requires acknowledgement from both CG and MC.
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "data.db");

// ── Keyword taxonomy ──────────────────────────────────────────────────────────

type TagCategory = "symptom" | "activity" | "food" | "sleep" | "mood";
type Severity = "mild" | "moderate" | "severe";

interface TagRule {
  tag: string;
  category: TagCategory;
  keywords: string[];
  severityModifiers: { keywords: string[]; severity: Severity }[];
  defaultSeverity: Severity;
}

const TAG_RULES: TagRule[] = [
  // ── Symptoms ──
  {
    tag: "headache",
    category: "symptom",
    keywords: ["headache", "head pain", "head ache", "migraine", "head hurts", "head is hurting", "head was hurting"],
    severityModifiers: [
      { keywords: ["severe", "debilitating", "very bad", "worst", "terrible", "excruciating", "could not", "couldn't"], severity: "severe" },
      { keywords: ["mild", "slight", "little", "minor", "small"], severity: "mild" },
    ],
    defaultSeverity: "moderate",
  },
  {
    tag: "dizziness",
    category: "symptom",
    keywords: ["dizzy", "dizziness", "lightheaded", "light-headed", "vertigo", "unsteady", "spinning", "off balance"],
    severityModifiers: [
      { keywords: ["fell", "fallen", "fainted", "passed out", "had to sit", "had to lie", "very dizzy", "severely"], severity: "severe" },
      { keywords: ["slight", "little", "mild", "brief", "momentary"], severity: "mild" },
    ],
    defaultSeverity: "moderate",
  },
  {
    tag: "nausea",
    category: "symptom",
    keywords: ["nausea", "nauseous", "queasy", "sick to stomach", "stomach upset", "vomit", "threw up", "vomiting"],
    severityModifiers: [
      { keywords: ["vomit", "threw up", "vomiting", "could not eat", "couldn't eat", "refused all"], severity: "severe" },
      { keywords: ["slight", "little", "mild", "brief"], severity: "mild" },
    ],
    defaultSeverity: "moderate",
  },
  {
    tag: "pain",
    category: "symptom",
    keywords: ["pain", "aching", "ache", "hurting", "hurts", "sore", "soreness", "discomfort", "cramps", "cramping"],
    severityModifiers: [
      { keywords: ["severe", "intense", "excruciating", "sharp", "10 out of", "level 8", "level 9", "level 10"], severity: "severe" },
      { keywords: ["mild", "slight", "minor", "manageable", "low level"], severity: "mild" },
    ],
    defaultSeverity: "moderate",
  },
  {
    tag: "fatigue",
    category: "symptom",
    keywords: ["tired", "fatigue", "exhausted", "exhaustion", "lethargic", "low energy", "no energy", "worn out", "weak", "weakness"],
    severityModifiers: [
      { keywords: ["extremely", "very", "completely", "slept all day", "would not get up", "bedridden"], severity: "severe" },
      { keywords: ["slightly", "a little", "mild", "minor"], severity: "mild" },
    ],
    defaultSeverity: "moderate",
  },
  {
    tag: "confusion",
    category: "symptom",
    keywords: ["confused", "confusion", "disoriented", "not oriented", "forgetful", "memory", "foggy", "unclear thinking", "not himself", "not herself"],
    severityModifiers: [
      { keywords: ["severely", "extreme", "did not know", "didn't know", "could not recognize", "agitated"], severity: "severe" },
      { keywords: ["slightly", "mildly", "brief", "momentary"], severity: "mild" },
    ],
    defaultSeverity: "moderate",
  },
  {
    tag: "shortness_of_breath",
    category: "symptom",
    keywords: ["short of breath", "shortness of breath", "difficulty breathing", "hard to breathe", "breathing trouble", "winded", "gasping"],
    severityModifiers: [
      { keywords: ["severe", "very", "could not", "couldn't", "emergency", "called 911"], severity: "severe" },
      { keywords: ["mild", "slight", "brief", "minor"], severity: "mild" },
    ],
    defaultSeverity: "moderate",
  },
  {
    tag: "swelling",
    category: "symptom",
    keywords: ["swelling", "swollen", "edema", "puffy", "bloated", "inflammation"],
    severityModifiers: [
      { keywords: ["severe", "significant", "notably", "much worse"], severity: "severe" },
      { keywords: ["slight", "mild", "minor", "small"], severity: "mild" },
    ],
    defaultSeverity: "moderate",
  },
  {
    tag: "rash",
    category: "symptom",
    keywords: ["rash", "hives", "itching", "itchy", "skin irritation", "redness", "red spots", "breakout"],
    severityModifiers: [
      { keywords: ["severe", "spreading", "all over", "face", "throat", "allergic reaction"], severity: "severe" },
      { keywords: ["small", "mild", "minor", "slight"], severity: "mild" },
    ],
    defaultSeverity: "moderate",
  },
  {
    tag: "appetite_loss",
    category: "symptom",
    keywords: ["no appetite", "lost appetite", "not hungry", "refused food", "would not eat", "wouldn't eat", "did not eat", "didn't eat", "skipped meal", "ate nothing"],
    severityModifiers: [
      { keywords: ["refused all", "nothing at all", "all meals", "entire day"], severity: "severe" },
      { keywords: ["little", "small amount", "minor"], severity: "mild" },
    ],
    defaultSeverity: "moderate",
  },

  // ── Food / Nutrition ──
  {
    tag: "poor_appetite",
    category: "food",
    keywords: ["ate very little", "poor appetite", "didn't finish", "did not finish", "left most", "half his meal", "half her meal", "barely ate", "ate poorly"],
    severityModifiers: [
      { keywords: ["refused", "nothing", "all three meals", "all meals"], severity: "severe" },
      { keywords: ["slightly", "a little less"], severity: "mild" },
    ],
    defaultSeverity: "mild",
  },
  {
    tag: "good_appetite",
    category: "food",
    keywords: ["ate well", "good appetite", "finished meal", "finished his meal", "finished her meal", "ate everything", "enjoyed breakfast", "enjoyed lunch", "enjoyed dinner"],
    severityModifiers: [],
    defaultSeverity: "mild",
  },
  {
    tag: "dehydration_risk",
    category: "food",
    keywords: ["not drinking", "refused fluids", "didn't drink", "low fluid", "dehydrated", "dry mouth", "thirsty but refusing"],
    severityModifiers: [
      { keywords: ["very little", "almost nothing", "refused all"], severity: "severe" },
    ],
    defaultSeverity: "moderate",
  },

  // ── Sleep ──
  {
    tag: "poor_sleep",
    category: "sleep",
    keywords: ["didn't sleep", "did not sleep", "restless night", "restless sleep", "up all night", "couldn't sleep", "could not sleep", "insomnia", "woke up several", "woke frequently", "slept poorly", "bad night"],
    severityModifiers: [
      { keywords: ["all night", "not at all", "no sleep", "3 hours", "2 hours", "1 hour"], severity: "severe" },
      { keywords: ["slightly", "minor", "brief", "once or twice"], severity: "mild" },
    ],
    defaultSeverity: "moderate",
  },
  {
    tag: "good_sleep",
    category: "sleep",
    keywords: ["slept well", "good sleep", "rested well", "great night", "slept through", "full night"],
    severityModifiers: [],
    defaultSeverity: "mild",
  },
  {
    tag: "excessive_sleep",
    category: "sleep",
    keywords: ["slept all day", "sleeping a lot", "hard to wake", "very drowsy", "extremely tired", "oversleeping", "slept most of"],
    severityModifiers: [
      { keywords: ["all day", "could not wake", "unresponsive", "semi-conscious"], severity: "severe" },
    ],
    defaultSeverity: "moderate",
  },

  // ── Activity ──
  {
    tag: "walk",
    category: "activity",
    keywords: ["went for a walk", "took a walk", "walked", "morning walk", "evening walk", "short walk"],
    severityModifiers: [],
    defaultSeverity: "mild",
  },
  {
    tag: "physical_therapy",
    category: "activity",
    keywords: ["physical therapy", "pt session", "therapy session", "exercises with pt", "occupational therapy", "ot session"],
    severityModifiers: [],
    defaultSeverity: "mild",
  },
  {
    tag: "fall",
    category: "activity",
    keywords: ["fell", "fallen", "fall", "tripped", "slipped", "lost balance", "stumbled"],
    severityModifiers: [
      { keywords: ["injured", "bleeding", "hospital", "er", "emergency", "911", "fracture", "broke"], severity: "severe" },
      { keywords: ["caught himself", "caught herself", "minor", "no injury", "near fall"], severity: "mild" },
    ],
    defaultSeverity: "severe",
  },
  {
    tag: "low_activity",
    category: "activity",
    keywords: ["stayed in bed", "did not leave room", "refused to move", "would not get up", "sedentary", "no activity", "rested all day"],
    severityModifiers: [],
    defaultSeverity: "moderate",
  },

  // ── Mood ──
  {
    tag: "agitation",
    category: "mood",
    keywords: ["agitated", "agitation", "upset", "angry", "frustrated", "combative", "resistive", "yelling", "refusing care"],
    severityModifiers: [
      { keywords: ["very", "extremely", "violent", "combative", "screaming"], severity: "severe" },
      { keywords: ["slightly", "mildly", "briefly", "settled quickly"], severity: "mild" },
    ],
    defaultSeverity: "moderate",
  },
  {
    tag: "anxiety",
    category: "mood",
    keywords: ["anxious", "anxiety", "nervous", "worried", "fearful", "scared", "panicked", "panic"],
    severityModifiers: [
      { keywords: ["severe", "panic attack", "very anxious", "extreme"], severity: "severe" },
      { keywords: ["slightly", "mildly", "brief", "settled"], severity: "mild" },
    ],
    defaultSeverity: "moderate",
  },
  {
    tag: "low_mood",
    category: "mood",
    keywords: ["sad", "depressed", "depression", "tearful", "crying", "withdrawn", "quiet today", "not himself", "not herself", "lonely"],
    severityModifiers: [
      { keywords: ["very", "extremely", "inconsolable", "refused to talk", "would not respond"], severity: "severe" },
      { keywords: ["slightly", "mildly", "briefly", "cheered up"], severity: "mild" },
    ],
    defaultSeverity: "moderate",
  },
  {
    tag: "good_mood",
    category: "mood",
    keywords: ["great mood", "happy", "cheerful", "laughing", "enjoyed", "smiled", "good spirits", "positive"],
    severityModifiers: [],
    defaultSeverity: "mild",
  },
];

// ── Auto-tagger ───────────────────────────────────────────────────────────────

export interface ExtractedTag {
  category: TagCategory;
  tag: string;
  severity: Severity;
  rawText: string;
}

export function extractTags(text: string): ExtractedTag[] {
  if (!text || text.trim().length < 3) return [];
  const lower = text.toLowerCase();
  const found: ExtractedTag[] = [];

  for (const rule of TAG_RULES) {
    const matched = rule.keywords.some(kw => lower.includes(kw));
    if (!matched) continue;

    // Determine severity
    let severity: Severity = rule.defaultSeverity;
    for (const mod of rule.severityModifiers) {
      if (mod.keywords.some(kw => lower.includes(kw))) {
        severity = mod.severity;
        break;
      }
    }

    // Find the raw phrase that triggered it
    const matchedKw = rule.keywords.find(kw => lower.includes(kw)) ?? rule.tag;
    const idx = lower.indexOf(matchedKw);
    const rawStart = Math.max(0, idx - 20);
    const rawEnd = Math.min(text.length, idx + matchedKw.length + 30);
    const rawText = text.slice(rawStart, rawEnd).trim();

    found.push({ category: rule.category, tag: rule.tag, severity, rawText });
  }

  return found;
}

// ── Tag persistence ───────────────────────────────────────────────────────────

export function saveTagsForEntry(
  clientId: number,
  sourceType: "activity_log" | "vitals" | "medication_log",
  sourceId: number,
  observedAt: string,
  text: string
): void {
  const tags = extractTags(text);
  if (tags.length === 0) return;

  const db = new Database(DB_PATH);
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO observation_tags (client_id, source_type, source_id, observed_at, category, tag, severity, raw_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const t of tags) {
    // Don't duplicate — check if this source already has this tag
    const exists = db
      .prepare(`SELECT id FROM observation_tags WHERE source_type=? AND source_id=? AND tag=?`)
      .get(sourceType, sourceId, t.tag);
    if (!exists) {
      stmt.run(clientId, sourceType, sourceId, observedAt, t.category, t.tag, t.severity, t.rawText, now);
    }
  }
  db.close();
}

// ── Pattern engine ────────────────────────────────────────────────────────────

interface MedContext {
  id: number;
  name: string;
  scheduledTimes: string | null; // JSON array of "HH:MM"
  startDate: string | null;
}

function getRecentMeds(db: Database.Database, clientId: number): MedContext[] {
  return db
    .prepare(`SELECT id, name, scheduled_times, start_date FROM medications WHERE client_id=? AND status='active'`)
    .all(clientId) as MedContext[];
}

function isWithinHoursOfMed(observedAt: string, scheduledTimes: string | null, windowHours = 3): boolean {
  if (!scheduledTimes) return true; // assume possible correlation if no time data
  try {
    const times: string[] = JSON.parse(scheduledTimes);
    const obs = new Date(observedAt);
    const obsHour = obs.getHours() + obs.getMinutes() / 60;
    return times.some(t => {
      const [h, m] = t.split(":").map(Number);
      const medHour = h + m / 60;
      return Math.abs(obsHour - medHour) <= windowHours;
    });
  } catch {
    return true;
  }
}

function dayKey(iso: string): string {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

function countConsecutiveDays(days: Set<string>): number {
  const sorted = Array.from(days).sort().reverse();
  if (sorted.length === 0) return 0;
  let streak = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = new Date(sorted[i]);
    const b = new Date(sorted[i + 1]);
    const diff = (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
    if (Math.abs(diff - 1) < 0.1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function generateDoctorNote(
  clientName: string,
  doctorName: string | null,
  label: string,
  symptomTag: string,
  occurrences: number,
  dayRange: number,
  correlatedMeds: { name: string }[],
  dates: string[]
): string {
  const dr = doctorName ? `Dr. ${doctorName}` : "the care team";
  const medList = correlatedMeds.map(m => m.name).join(", ");
  const dateList = dates.slice(0, 5).map(d => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })).join(", ");
  const symptomReadable = symptomTag.replace(/_/g, " ");

  return `${dr},

We wanted to bring a pattern to your attention regarding ${clientName}.

Over the past ${dayRange} days, ${clientName} has experienced ${symptomReadable} on ${occurrences} occasions${correlatedMeds.length > 0 ? `, typically within 1–3 hours of their medications (${medList})` : ""}. ${dates.length > 0 ? `Dates observed: ${dateList}${dates.length > 5 ? ", and others" : ""}.` : ""}

We are not drawing conclusions — this may be coincidental or unrelated. However, because consistent logging made this pattern visible, we felt it was worth sharing with you in case any adjustment or follow-up is appropriate.

Please let us know if you would like additional information from our care log.

Thank you,
${clientName}'s Care Team`;
}

// ── Main engine run ───────────────────────────────────────────────────────────

export async function runPatternEngine(clientId: number): Promise<void> {
  const db = new Database(DB_PATH);
  const now = new Date();
  const windowStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Get client info
  const client = db.prepare(`SELECT name, primary_contact_id FROM clients WHERE id=?`).get(clientId) as
    | { name: string; primary_contact_id: number | null }
    | undefined;
  if (!client) { db.close(); return; }

  // Get active medications
  const meds = getRecentMeds(db, clientId);

  // Get all observation tags in the last 14 days
  const tags = db
    .prepare(`SELECT * FROM observation_tags WHERE client_id=? AND observed_at >= ? AND category IN ('symptom','sleep','food') ORDER BY observed_at ASC`)
    .all(clientId, windowStart) as Array<{
      id: number; tag: string; category: string; severity: string;
      observed_at: string; source_id: number; source_type: string; raw_text: string;
    }>;

  // Group tags by (tag) → list of observations
  const grouped = new Map<string, typeof tags>();
  for (const t of tags) {
    if (!grouped.has(t.tag)) grouped.set(t.tag, []);
    grouped.get(t.tag)!.push(t);
  }

  for (const [tag, observations] of grouped) {
    // Only run pattern detection on moderate/severe observations
    const significant = observations.filter(o => o.severity !== "mild" || o.category === "sleep");
    if (significant.length < 2) continue;

    // Find correlated medications (observed within 3 hours of a med time)
    const correlatedMeds = meds.filter(med =>
      significant.some(o => isWithinHoursOfMed(o.observed_at, med.scheduledTimes))
    );

    // Collect unique days
    const uniqueDays = new Set(significant.map(o => dayKey(o.observed_at)));
    const consecutiveDays = countConsecutiveDays(uniqueDays);
    const occurrenceCount = significant.length;

    // Count occurrences in last 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const lastWeekCount = significant.filter(o => o.observed_at >= sevenDaysAgo).length;

    // Determine dominant severity
    const hasSevere = significant.some(o => o.severity === "severe");
    const dominantSeverity: Severity = hasSevere ? "severe" : "moderate";

    // Only push-notify for moderate/severe. Mild patterns go to summary only.
    const shouldPush = dominantSeverity !== "mild";
    if (!shouldPush && occurrenceCount < 4) continue;

    // Build pattern key and label
    const medSuffix = correlatedMeds.length > 0
      ? `_after_${correlatedMeds[0].name.toLowerCase().replace(/\s+/g, "_").slice(0, 20)}`
      : "";
    const patternKey = `${tag}${medSuffix}`;
    const tagReadable = tag.replace(/_/g, " ");
    const medReadable = correlatedMeds.length > 0 ? ` after ${correlatedMeds[0].name}` : "";
    const label = `${tagReadable.charAt(0).toUpperCase() + tagReadable.slice(1)}${medReadable}`;

    const sortedDates = significant.map(o => o.observed_at).sort();
    const firstSeen = sortedDates[0];
    const lastSeen = sortedDates[sortedDates.length - 1];

    // Build description
    const medCtx = correlatedMeds.length > 0
      ? ` — typically within 1–3 hours of ${correlatedMeds.map(m => m.name).join(" and ")}`
      : "";
    const description =
      consecutiveDays >= 3
        ? `${client.name} has been experiencing ${tagReadable} for ${consecutiveDays} consecutive days${medCtx}.`
        : `${client.name} has experienced ${tagReadable} ${occurrenceCount} time${occurrenceCount !== 1 ? "s" : ""} over the past 14 days${medCtx}.`;

    // Check if pattern already exists
    const existing = db
      .prepare(`SELECT * FROM health_patterns WHERE client_id=? AND pattern_key=? AND status='active'`)
      .get(clientId, patternKey) as any;

    if (existing) {
      // Update occurrence counts
      db.prepare(
        `UPDATE health_patterns SET occurrence_count=?, consecutive_days=?, last_seen_at=?, description=?, severity=?, updated_at=? WHERE id=?`
      ).run(occurrenceCount, consecutiveDays, lastSeen, description, dominantSeverity, now.toISOString(), existing.id);

      // Fire thresholds if not already fired
      await fireThresholdsIfNeeded(db, existing, {
        consecutiveDays, occurrenceCount, lastWeekCount,
        clientId, client, correlatedMeds, sortedDates, label, dominantSeverity, tag
      });
    } else {
      // Create new pattern
      const doctorNote = generateDoctorNote(
        client.name,
        null, // doctor name lookup could be added later
        label, tag, occurrenceCount, 14,
        correlatedMeds, sortedDates
      );

      const result = db.prepare(
        `INSERT INTO health_patterns
         (client_id, pattern_key, label, description, symptom_tag, correlated_with, severity,
          occurrence_count, consecutive_days, window_days, first_seen_at, last_seen_at,
          doctor_note_text, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,14,?,?,?,?,?)`
      ).run(
        clientId, patternKey, label, description, tag,
        JSON.stringify(correlatedMeds.map(m => ({ type: "medication", name: m.name, id: m.id }))),
        dominantSeverity, occurrenceCount, consecutiveDays,
        firstSeen, lastSeen, doctorNote,
        now.toISOString(), now.toISOString()
      );

      const newId = (result as any).lastInsertRowid;
      const newPattern = db.prepare(`SELECT * FROM health_patterns WHERE id=?`).get(newId) as any;
      await fireThresholdsIfNeeded(db, newPattern, {
        consecutiveDays, occurrenceCount, lastWeekCount,
        clientId, client, correlatedMeds, sortedDates, label, dominantSeverity, tag
      });
    }
  }

  db.close();
}

async function fireThresholdsIfNeeded(
  db: Database.Database,
  pattern: any,
  ctx: {
    consecutiveDays: number; occurrenceCount: number; lastWeekCount: number;
    clientId: number; client: { name: string; primary_contact_id: number | null };
    correlatedMeds: { id: number; name: string }[];
    sortedDates: string[]; label: string; dominantSeverity: Severity; tag: string;
  }
) {
  const now = new Date().toISOString();
  const { consecutiveDays, occurrenceCount, lastWeekCount, clientId, client, label, dominantSeverity } = ctx;

  // Get all users for this client (CG + MC)
  const users = db.prepare(
    `SELECT id, role FROM users WHERE client_id=? AND is_active=1 AND role IN ('caregiver','multi_caregiver','primary_family','secondary_family')`
  ).all(clientId) as { id: number; role: string }[];

  const cgUsers = users.filter(u => ["caregiver", "multi_caregiver"].includes(u.role));
  const mcUsers = users.filter(u => ["primary_family", "secondary_family"].includes(u.role));

  function sendNotifications(alertLevel: string, title: string, body: string, updateField: string) {
    // Update pattern to mark threshold as fired
    db.prepare(`UPDATE health_patterns SET ${updateField}=?, updated_at=? WHERE id=?`).run(now, now, pattern.id);

    // Notify all CG + MC users
    const notifStmt = db.prepare(
      `INSERT INTO notifications (user_id, client_id, title, body, type, priority, is_read, created_at, link_to)
       VALUES (?,?,?,?,?,?,0,?,?)`
    );
    const priority = dominantSeverity === "severe" ? "red" : "yellow";
    for (const u of [...cgUsers, ...mcUsers]) {
      notifStmt.run(u.id, clientId, title, body, "pattern", priority, now, "/patterns");
    }
  }

  // Track A — consecutive days
  if (consecutiveDays >= 7 && !pattern.alert_7day_fired_at) {
    const tagReadable = ctx.tag.replace(/_/g, " ");
    sendNotifications(
      "7day",
      `Pattern: ${label}`,
      `${client.name} has experienced ${tagReadable} for 7 consecutive days. Because consistent logging made this visible, it may be worth discussing with their physician. You can review the pattern and draft a note from the Patterns section.`,
      "alert_7day_fired_at"
    );
  } else if (consecutiveDays >= 3 && !pattern.alert_3day_fired_at && dominantSeverity !== "mild") {
    const tagReadable = ctx.tag.replace(/_/g, " ");
    sendNotifications(
      "3day",
      `Something worth watching: ${label}`,
      `Because of careful logging, we noticed ${client.name} has experienced ${tagReadable} for 3 days in a row. This may be nothing — but it's interesting to note. You can view the full pattern in the Patterns section.`,
      "alert_3day_fired_at"
    );
  }

  // Track B — semi-regular
  if (occurrenceCount >= 6 && lastWeekCount >= 3 && !pattern.alert_6x_2week_fired_at) {
    const tagReadable = ctx.tag.replace(/_/g, " ");
    sendNotifications(
      "6x_2week",
      `Pattern: ${label}`,
      `${client.name} has experienced ${tagReadable} ${occurrenceCount} times over the past 14 days. This pattern may be worth mentioning to their physician. A draft note is ready in the Patterns section.`,
      "alert_6x_2week_fired_at"
    );
  } else if (lastWeekCount >= 3 && !pattern.alert_3x_week_fired_at && dominantSeverity !== "mild") {
    const tagReadable = ctx.tag.replace(/_/g, " ");
    sendNotifications(
      "3x_week",
      `Something worth watching: ${label}`,
      `Because of careful logging, we noticed ${client.name} has experienced ${tagReadable} ${lastWeekCount} times this week. This may be worth keeping an eye on. View it in the Patterns section.`,
      "alert_3x_week_fired_at"
    );
  }
}

// ── Resolved pattern check ────────────────────────────────────────────────────
// If a pattern has no new observations in 7 days, mark it resolved

export function checkResolvedPatterns(clientId: number): void {
  const db = new Database(DB_PATH);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const activePatterns = db
    .prepare(`SELECT * FROM health_patterns WHERE client_id=? AND status='active'`)
    .all(clientId) as any[];

  for (const p of activePatterns) {
    const recentTag = db
      .prepare(`SELECT id FROM observation_tags WHERE client_id=? AND tag=? AND observed_at >= ?`)
      .get(clientId, p.symptom_tag, sevenDaysAgo);
    if (!recentTag) {
      db.prepare(`UPDATE health_patterns SET status='resolved', resolved_at=?, updated_at=? WHERE id=?`)
        .run(now, now, p.id);
    }
  }

  db.close();
}

// ── Re-surface dismissed patterns ─────────────────────────────────────────────

export function resurfaceDismissedPatterns(clientId: number): void {
  const db = new Database(DB_PATH);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE health_patterns SET status='active', dismissed_at=NULL, dismissed_until=NULL, updated_at=?
     WHERE client_id=? AND status='dismissed' AND dismissed_until <= ?`
  ).run(now, clientId, now);

  db.close();
}
