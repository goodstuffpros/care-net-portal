/**
 * Badge Scoring Engine — Care Net Portal
 *
 * Four dimensions: Communication, Dependability, Knowledge, Connection
 * Overall weights: Communication 22%, Dependability 28%, Knowledge 18%, Connection 32%
 *
 * Each dimension blends objective (portal data) + subjective (family survey).
 * Communication objective is further split: response speed 40%, AI quality 45%, participation 15%.
 */

import { db } from "./db";
import {
  shifts, careFlags, scheduleEvents, messages, chatThreads,
  activityLogs, mediaItems, outings, vitals, medicationLogs, medications,
  badgeSurveys, badgeScores, careScopes, clients,
  type BadgeScore, type CareScope,
} from "@shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

// ── Scope helpers ─────────────────────────────────────────────────────────────

function getScope(caregiverId: number, clientId: number): Pick<CareScope, 'medications' | 'vitals' | 'appointments'> {
  const scope = db.select().from(careScopes)
    .where(and(eq(careScopes.caregiverId, caregiverId), eq(careScopes.clientId, clientId)))
    .get();
  // Default to fully active if no scope record exists
  return {
    medications: scope?.medications ?? true,
    vitals: scope?.vitals ?? true,
    appointments: scope?.appointments ?? true,
  };
}

// ── Constants ────────────────────────────────────────────────────────────────

const WINDOW_DAYS = 30;
const PRIOR_WINDOW_DAYS = 60; // prior 30 days for decay weighting
const MIN_DATA_DAYS = 14;
const DECAY_WEIGHT = 0.5; // prior window counts at 50%

// Overall dimension weights
const DIM_WEIGHTS = {
  communication: 0.22,
  dependability: 0.28,
  knowledge: 0.18,
  connection: 0.32,
};

// Objective vs subjective split per dimension
const OBJ_SUBJ = {
  communication: { obj: 0.40, subj: 0.60 },
  dependability: { obj: 0.70, subj: 0.30 },
  knowledge:     { obj: 0.25, subj: 0.75 },
  connection:    { obj: 0.15, subj: 0.85 },
};

// Communication objective sub-weights
const COMM_OBJ_WEIGHTS = {
  responseSpeed:   0.40,
  messageQuality:  0.45,
  participation:   0.15,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function scoreToHearts(score: number): number {
  // 0–100 → 0.0–5.0, rounded to nearest 0.5
  const raw = (score / 100) * 5;
  return Math.round(raw * 2) / 2;
}

function windowStart(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString();
}

/**
 * AI Message Quality Scorer
 * Analyzes caregiver message content and returns a 0–100 quality score.
 * Context-aware: short replies to short messages are NOT penalized.
 */
function scoreMessageQuality(messages: Array<{ content: string; contextLength: number }>): number {
  if (messages.length === 0) return 75; // neutral default when no messages

  const LOW_EFFORT = [
    /^(ok|okay|k|sure|yes|no|yep|nope|👍|✓|idk|idc|brb|lol|haha|hmm|ugh)$/i,
    /^(will do|on it|got it|done|fine|noted)$/i,
  ];

  const DISMISSIVE = [
    /\bidk\b/i, /\bidc\b/i, /\bbrb\b/i, /\bnot sure\b/i,
  ];

  const POSITIVE_SIGNALS = [
    /\b(robert|he|she|they)\b.*\b(smiled|laughed|enjoyed|happy|calm|responding|improving|engaged)\b/i,
    /\b(i will|i'll|i can|i checked|i noticed|i made sure|i helped|let me)\b/i,
    /\b(specifically|because|however|although|in addition|also|furthermore)\b/i,
  ];

  let totalScore = 0;

  for (const msg of messages) {
    const content = msg.content.trim();
    const wordCount = content.split(/\s+/).length;
    const contextIsSubstantial = msg.contextLength > 20; // family wrote a real message

    let msgScore = 70; // baseline

    // If context is short (routine ping), brief reply is fine
    if (!contextIsSubstantial) {
      msgScore = 80;
      totalScore += msgScore;
      continue;
    }

    // Penalize low-effort when context demanded more
    const isLowEffort = LOW_EFFORT.some(r => r.test(content));
    if (isLowEffort) {
      msgScore -= 35;
    } else if (wordCount < 5) {
      msgScore -= 15;
    }

    // Penalize dismissive language
    const isDismissive = DISMISSIVE.some(r => r.test(content));
    if (isDismissive) msgScore -= 20;

    // Reward positive signals
    const positiveCount = POSITIVE_SIGNALS.filter(r => r.test(content)).length;
    msgScore += positiveCount * 10;

    // Reward proportionate length (10–80 words is the sweet spot)
    if (wordCount >= 10 && wordCount <= 80) msgScore += 10;
    else if (wordCount > 80) msgScore += 5; // thorough but verbose

    totalScore += clamp(msgScore);
  }

  return clamp(totalScore / messages.length);
}

// ── Objective Scorers ────────────────────────────────────────────────────────

function scoreCommResponseSpeed(
  caregiverMessages: Array<{ sentAt: string; threadId: number }>,
  familyMessages: Array<{ sentAt: string; threadId: number; priority: string }>,
  caregiverShifts: Array<{ clockedInAt: string; clockedOutAt: string | null }>
): number {
  const highPriorityFamilyMsgs = familyMessages.filter(m => m.priority === "red" || m.priority === "yellow");
  if (highPriorityFamilyMsgs.length === 0) return 85; // no high-priority msgs — neutral good

  let totalScore = 0;
  let scored = 0;

  for (const fm of highPriorityFamilyMsgs) {
    const sentTime = new Date(fm.sentAt).getTime();

    // Find if caregiver was on shift when message was sent
    const onShift = caregiverShifts.some(s => {
      const inTime = new Date(s.clockedInAt).getTime();
      const outTime = s.clockedOutAt ? new Date(s.clockedOutAt).getTime() : Date.now();
      return sentTime >= inTime && sentTime <= outTime;
    });

    if (!onShift) continue; // not during shift — not scored

    // Find first caregiver reply in same thread after family message
    const reply = caregiverMessages
      .filter(cm => cm.threadId === fm.threadId && new Date(cm.sentAt).getTime() > sentTime)
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())[0];

    if (!reply) {
      totalScore += 0; // no reply at all
    } else {
      const minutesDiff = (new Date(reply.sentAt).getTime() - sentTime) / 60000;
      // <15min = 100, <30min = 85, <60min = 70, <120min = 50, <240min = 25, 4hr+ = 0
      if (minutesDiff < 15) totalScore += 100;
      else if (minutesDiff < 30) totalScore += 85;
      else if (minutesDiff < 60) totalScore += 70;
      else if (minutesDiff < 120) totalScore += 50;
      else if (minutesDiff < 240) totalScore += 25;
      else totalScore += 0;
    }
    scored++;
  }

  return scored > 0 ? clamp(totalScore / scored) : 85;
}

function scoreCommParticipation(
  caregiverMessages: Array<{ sentAt: string }>,
  totalThreadsActive: number
): number {
  if (totalThreadsActive === 0) return 75;
  const avgMsgsPerThread = caregiverMessages.length / totalThreadsActive;
  // Expected ~5+ msgs per thread per month = 100
  return clamp((avgMsgsPerThread / 5) * 100);
}

function scoreDepShiftAccuracy(
  shiftsData: Array<{ clockedInAt: string; clockedOutAt: string | null }>,
  scheduleData: Array<{ scheduledAt: string; isCompleted: boolean; type: string }>
): number {
  // Proxy: did caregiver log shifts consistently (at least 5 shifts in window)?
  const completedShifts = shiftsData.filter(s => s.clockedOutAt !== null).length;
  if (completedShifts === 0) return 50;
  // More complete shifts = higher score, cap at 100 for 20+ shifts
  return clamp((completedShifts / 20) * 100);
}

function scoreDepFlags(
  flags: Array<{ flagType: string; isExcused: boolean }>
): number {
  const unexcusedYellow = flags.filter(f => f.flagType === "yellow" && !f.isExcused).length;
  const unexcusedRed = flags.filter(f => f.flagType === "red" && !f.isExcused).length;
  // Same formula as rating system: 100 - (yellow×3) - (red×8), but expressed 0–100
  return clamp(100 - (unexcusedYellow * 3) - (unexcusedRed * 8));
}

function scoreDepAppointments(
  scheduleData: Array<{ scheduledAt: string; isCompleted: boolean; caregiverResponsible: boolean; type: string }>
): number {
  const caregiverAppts = scheduleData.filter(
    s => s.caregiverResponsible && s.type === "appointment"
  );
  if (caregiverAppts.length === 0) return 85;
  const completed = caregiverAppts.filter(s => s.isCompleted).length;
  return clamp((completed / caregiverAppts.length) * 100);
}

function scoreKnwMedication(
  medLogs: Array<{ loggedAt: string; scheduledTime: string | null; wasGiven: boolean; refusedOrMissed: boolean }>
): number {
  const scheduled = medLogs.filter(l => l.scheduledTime !== null);
  if (scheduled.length === 0) return 80;

  let onTimeCount = 0;
  for (const log of scheduled) {
    if (!log.scheduledTime) continue;
    const logged = new Date(log.loggedAt).getTime();
    const scheduled = new Date(log.scheduledTime).getTime();
    const diffMin = Math.abs(logged - scheduled) / 60000;
    if (diffMin <= 60) onTimeCount++; // within 1hr = on time
  }
  return clamp((onTimeCount / scheduled.length) * 100);
}

function scoreKnwVitals(
  vitalsData: Array<{ recordedAt: string }>,
  daysInWindow: number
): number {
  if (daysInWindow === 0) return 75;
  // Expect at least once-daily vitals
  const expectedEntries = daysInWindow;
  return clamp((vitalsData.length / expectedEntries) * 100);
}

function scoreConPortalSignals(
  outingsData: Array<unknown>,
  activityLogsData: Array<{ description: string | null; title: string }>,
  mediaData: Array<unknown>,
  miscNotesData: Array<unknown>,
  daysInWindow: number
): number {
  if (daysInWindow === 0) return 50;

  let score = 50; // baseline

  // Outings beyond base care plan (any outing = positive signal)
  score += Math.min(outingsData.length * 5, 15);

  // Emotional language in activity logs
  const EMOTIONAL_KEYWORDS = [
    /\b(smiled|laughed|enjoyed|happy|calm|engaged|responding|brightened|excited|content|pleased|giggled)\b/i,
    /\b(seemed|appeared|looked|felt|mood)\b/i,
    /\b(favorite|loved|remembered|stories|music|family|together)\b/i,
  ];
  const emotionalLogs = activityLogsData.filter(l =>
    EMOTIONAL_KEYWORDS.some(r => r.test(l.title + " " + (l.description || "")))
  );
  score += Math.min(emotionalLogs.length * 3, 20);

  // Media uploads (voluntary moments captured)
  score += Math.min(mediaData.length * 4, 15);

  // Misc notes (unprompted observations)
  score += Math.min(miscNotesData.length * 2, 10);

  return clamp(score);
}

// ── Subjective Scorers (from survey) ────────────────────────────────────────

function avgSurveyFields(survey: Record<string, number | null>, fields: string[]): number {
  const values = fields.map(f => survey[f]).filter(v => v !== null && v !== undefined) as number[];
  if (values.length === 0) return 75; // default when survey not submitted
  return clamp((values.reduce((a, b) => a + b, 0) / values.length) * 20); // 0–5 → 0–100
}

function subjectiveComm(survey: Record<string, number | null>): number {
  return avgSurveyFields(survey, ["commClarity", "commResponsive", "commProactive"]);
}
function subjectiveDep(survey: Record<string, number | null>): number {
  return avgSurveyFields(survey, ["depReliable", "depFollowThrough"]);
}
function subjectiveKnw(survey: Record<string, number | null>): number {
  return avgSurveyFields(survey, ["knwCompetence", "knwSituational"]);
}
function subjectiveCon(survey: Record<string, number | null>): number {
  return avgSurveyFields(survey, ["conHappiness", "conWarmth", "conPersonhood", "conAboveAndBeyond", "conFamilyConfidence"]);
}

// ── Main Compute Function ────────────────────────────────────────────────────

export async function computeBadgeScore(caregiverId: number, clientId: number): Promise<BadgeScore> {
  const now = new Date().toISOString();
  const windowFrom = windowStart(WINDOW_DAYS);
  const priorFrom = windowStart(PRIOR_WINDOW_DAYS);

  // ── Fetch scope for this relationship ──────────────────────────────
  const scope = getScope(caregiverId, clientId);

  // ── Pull all portal data ─────────────────────────────────────────────────

  const allShifts = db.select().from(shifts)
    .where(and(eq(shifts.caregiverId, caregiverId), eq(shifts.clientId, clientId), gte(shifts.clockedInAt, priorFrom)))
    .all();
  const recentShifts = allShifts.filter(s => s.clockedInAt >= windowFrom);

  const allFlags = db.select().from(careFlags)
    .where(and(eq(careFlags.caregiverId, caregiverId), eq(careFlags.clientId, clientId), gte(careFlags.triggeredAt, priorFrom)))
    .all();
  const recentFlags = allFlags.filter(f => f.triggeredAt >= windowFrom);

  const allSchedule = db.select().from(scheduleEvents)
    .where(and(eq(scheduleEvents.clientId, clientId), gte(scheduleEvents.scheduledAt, priorFrom)))
    .all();
  const recentSchedule = allSchedule.filter(s => s.scheduledAt >= windowFrom);

  // Messages — all threads for this client
  const allThreads = db.select().from(chatThreads).where(eq(chatThreads.clientId, clientId)).all();
  const threadIds = allThreads.map(t => t.id);

  let caregiverMsgs: Array<{ content: string; sentAt: string; threadId: number; senderId: number; priority: string }> = [];
  let familyMsgs: Array<{ content: string; sentAt: string; threadId: number; senderId: number; priority: string }> = [];

  for (const tid of threadIds) {
    const threadMsgs = db.select().from(messages)
      .where(and(eq(messages.threadId, tid), gte(messages.sentAt, windowFrom)))
      .all();
    const cgMsgs = threadMsgs.filter(m => m.senderId === caregiverId);
    const fMsgs = threadMsgs.filter(m => m.senderId !== caregiverId);
    caregiverMsgs = [...caregiverMsgs, ...cgMsgs];
    familyMsgs = [...familyMsgs, ...fMsgs];
  }

  const allActivityLogs = db.select().from(activityLogs)
    .where(and(eq(activityLogs.clientId, clientId), eq(activityLogs.loggedByUserId, caregiverId), gte(activityLogs.loggedAt, windowFrom)))
    .all();

  const allMedia = db.select().from(mediaItems)
    .where(and(eq(mediaItems.clientId, clientId), eq(mediaItems.uploadedByUserId, caregiverId), gte(mediaItems.uploadedAt, windowFrom)))
    .all();

  const allOutings = db.select().from(outings)
    .where(and(eq(outings.clientId, clientId), eq(outings.caregiverId, caregiverId), gte(outings.startedAt, windowFrom)))
    .all();

  const allVitals = db.select().from(vitals)
    .where(and(eq(vitals.clientId, clientId), eq(vitals.caregiverId, caregiverId), gte(vitals.recordedAt, windowFrom)))
    .all();

  const allMedLogs = db.select().from(medicationLogs)
    .where(and(eq(medicationLogs.clientId, clientId), eq(medicationLogs.caregiverId, caregiverId), gte(medicationLogs.loggedAt, windowFrom)))
    .all();

  // Latest survey in window (most recent month)
  const latestSurvey = db.select().from(badgeSurveys)
    .where(and(
      eq(badgeSurveys.caregiverId, caregiverId),
      eq(badgeSurveys.clientId, clientId),
      gte(badgeSurveys.submittedAt, windowFrom)
    ))
    .all()
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0] || null;

  const surveysInWindow = db.select().from(badgeSurveys)
    .where(and(
      eq(badgeSurveys.caregiverId, caregiverId),
      eq(badgeSurveys.clientId, clientId),
      gte(badgeSurveys.submittedAt, windowFrom)
    ))
    .all().length;

  // ── Data sufficiency ─────────────────────────────────────────────────────

  const daysActive = recentShifts.length > 0
    ? new Set(recentShifts.map(s => s.clockedInAt.slice(0, 10))).size
    : new Set(allActivityLogs.map(l => l.loggedAt.slice(0, 10))).size;

  const hasMinimumData = daysActive >= MIN_DATA_DAYS;

  // ── Objective Scores ─────────────────────────────────────────────────────

  // Communication quality: score each caregiver message with context
  const cgMsgsWithContext = caregiverMsgs.map(cm => {
    // Find the preceding family message in same thread
    const precedingFamilyMsg = familyMsgs
      .filter(fm => fm.threadId === cm.threadId && fm.sentAt < cm.sentAt)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
    return {
      content: cm.content,
      contextLength: precedingFamilyMsg ? precedingFamilyMsg.content.length : 0,
    };
  });

  const objCommSpeed = scoreCommResponseSpeed(
    caregiverMsgs.map(m => ({ sentAt: m.sentAt, threadId: m.threadId })),
    familyMsgs.map(m => ({ sentAt: m.sentAt, threadId: m.threadId, priority: m.priority || "green" })),
    recentShifts.map(s => ({ clockedInAt: s.clockedInAt, clockedOutAt: s.clockedOutAt || null }))
  );
  const objCommQuality = scoreMessageQuality(cgMsgsWithContext);
  const objCommParticipation = scoreCommParticipation(caregiverMsgs, threadIds.length);

  const objCommOverall =
    objCommSpeed * COMM_OBJ_WEIGHTS.responseSpeed +
    objCommQuality * COMM_OBJ_WEIGHTS.messageQuality +
    objCommParticipation * COMM_OBJ_WEIGHTS.participation;

  const objDepShift = scoreDepShiftAccuracy(recentShifts, recentSchedule);
  const objDepFlags = scoreDepFlags(recentFlags);
  // Dependability: exclude appointment score if appointments module is off
  const apptActive = scope.appointments !== false;
  const objDepAppts = apptActive ? scoreDepAppointments(recentSchedule.map(s => ({
    scheduledAt: s.scheduledAt,
    isCompleted: s.isCompleted || false,
    caregiverResponsible: s.caregiverResponsible !== false,
    type: s.type,
  }))) : null;

  // Normalize dependability weights when appointments are off
  const objDepOverall = apptActive && objDepAppts !== null
    ? (objDepShift * 0.35 + objDepFlags * 0.45 + objDepAppts * 0.20)
    : (objDepShift * 0.4375 + objDepFlags * 0.5625); // redistribute 35/45 proportionally

  // Knowledge sub-scores: exclude inactive modules from calculation (scope normalization)
  // If both medications AND vitals are off, knowledge is entirely survey-driven (skip obj)
  const medActive = scope.medications !== false;
  const vitActive = scope.vitals !== false;

  const objKnwMed = medActive ? scoreKnwMedication(allMedLogs.map(l => ({
    loggedAt: l.loggedAt,
    scheduledTime: l.scheduledTime || null,
    wasGiven: l.wasGiven,
    refusedOrMissed: l.refusedOrMissed || false,
  }))) : null;
  const objKnwVit = vitActive ? scoreKnwVitals(allVitals, daysActive || 1) : null;

  // Normalize weights based on which modules are active
  let objKnwOverall: number;
  if (objKnwMed !== null && objKnwVit !== null) {
    objKnwOverall = objKnwMed * 0.55 + objKnwVit * 0.45;
  } else if (objKnwMed !== null) {
    objKnwOverall = objKnwMed; // medications only
  } else if (objKnwVit !== null) {
    objKnwOverall = objKnwVit; // vitals only
  } else {
    objKnwOverall = 75; // no objective modules active — neutral
  }

  const objConSignals = scoreConPortalSignals(allOutings, allActivityLogs, allMedia, [], daysActive || 1);

  // ── Subjective Scores ─────────────────────────────────────────────────────

  const surveyData = latestSurvey
    ? (latestSurvey as Record<string, number | null>)
    : {} as Record<string, number | null>;

  const subjComm = subjectiveComm(surveyData);
  const subjDep = subjectiveDep(surveyData);
  const subjKnw = subjectiveKnw(surveyData);
  const subjCon = subjectiveCon(surveyData);

  // ── Dimension Scores ──────────────────────────────────────────────────────

  const commScore = clamp(
    objCommOverall * OBJ_SUBJ.communication.obj +
    subjComm * OBJ_SUBJ.communication.subj
  );
  const depScore = clamp(
    objDepOverall * OBJ_SUBJ.dependability.obj +
    subjDep * OBJ_SUBJ.dependability.subj
  );
  const knwScore = clamp(
    objKnwOverall * OBJ_SUBJ.knowledge.obj +
    subjKnw * OBJ_SUBJ.knowledge.subj
  );
  const conScore = clamp(
    objConSignals * OBJ_SUBJ.connection.obj +
    subjCon * OBJ_SUBJ.connection.subj
  );

  // ── Overall Score ─────────────────────────────────────────────────────────

  const rawOverallScore = clamp(
    commScore * DIM_WEIGHTS.communication +
    depScore * DIM_WEIGHTS.dependability +
    knwScore * DIM_WEIGHTS.knowledge +
    conScore * DIM_WEIGHTS.connection
  );

  // Practice client cap: sample portal activity earns max 25% of overall score
  const clientRecord = db.select().from(clients).where(eq(clients.id, clientId)).get();
  const isPractice = clientRecord?.isPractice ?? false;
  const PRACTICE_CAP = 25;
  const overallScore = isPractice ? Math.min(rawOverallScore, PRACTICE_CAP) : rawOverallScore;

  // ── Upsert into DB ────────────────────────────────────────────────────────

  // Delete previous score for this caregiver/client
  db.delete(badgeScores)
    .where(and(eq(badgeScores.caregiverId, caregiverId), eq(badgeScores.clientId, clientId)))
    .run();

  const result = db.insert(badgeScores).values({
    caregiverId,
    clientId,
    computedAt: now,
    communicationScore: commScore,
    dependabilityScore: depScore,
    knowledgeScore: knwScore,
    connectionScore: conScore,
    overallScore,
    heartsOverall: scoreToHearts(overallScore),
    heartsCommunication: scoreToHearts(commScore),
    heartsDependability: scoreToHearts(depScore),
    heartsKnowledge: scoreToHearts(knwScore),
    heartsConnection: scoreToHearts(conScore),
    objCommResponseSpeed: objCommSpeed,
    objCommQuality,
    objCommParticipation,
    objDepShiftAccuracy: objDepShift,
    objDepFlagScore: objDepFlags,
    objDepAppointments: objDepAppts ?? 85,
    objKnwMedication: objKnwMed ?? 75,
    objKnwVitals: objKnwVit ?? 75,
    objConPortalSignals: objConSignals,
    portalDaysActive: daysActive,
    hasMinimumData,
    surveysInWindow,
  }).returning().get();

  return result;
}

/**
 * Get or compute badge score for a caregiver.
 * Uses cached score if < 24 hours old, otherwise recomputes.
 */
export async function getBadgeScore(caregiverId: number, clientId: number): Promise<BadgeScore | null> {
  const cached = db.select().from(badgeScores)
    .where(and(eq(badgeScores.caregiverId, caregiverId), eq(badgeScores.clientId, clientId)))
    .get();

  if (cached) {
    const ageHours = (Date.now() - new Date(cached.computedAt).getTime()) / 3600000;
    if (ageHours < 24) return cached;
  }

  return computeBadgeScore(caregiverId, clientId);
}
