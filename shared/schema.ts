import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles: caregiver | temp_caregiver | multi_caregiver | primary_family | secondary_family | self_care | facilitator
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'caregiver' | 'temp_caregiver' | 'multi_caregiver' | 'primary_family' | 'secondary_family' | 'self_care' | 'facilitator'
  email: text("email").notNull(),
  phone: text("phone"),
  avatarInitials: text("avatar_initials"),
  clientId: integer("client_id"), // which client this user is associated with
  notificationPrefs: text("notification_prefs").default('{"all":true}'), // JSON string
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  onboardingCompletedAt: text("onboarding_completed_at"), // ISO date — null means not yet completed
  mcSetupCompletedAt: text("mc_setup_completed_at"),     // ISO date — null means MC wizard not yet done
  carePathChoice: text("care_path_choice"),               // 'has_caregiver' | 'self_managing'
  // Temporary caregiver fields
  tempAccessStart: text("temp_access_start"), // ISO date
  tempAccessEnd: text("temp_access_end"),   // ISO date
  tempAccessReason: text("temp_access_reason"), // 'vacation' | 'illness' | 'other'
  seenModules: text("seen_modules").default("[]"),
  navOrder: text("nav_order").default("[]"), // JSON array of module keys user has already seen intro for
  timezone: text("timezone"),               // IANA timezone string, e.g. "America/Chicago"
  sampleClientId: integer("sample_client_id"), // permanent reference to CG's showcase/sample client — never nulled on real connection
  permissionLevel: text("permission_level"), // self_care users only: 'observer' | 'contributor' | 'self_care_mc' | null
  contributorWelcomeSeen: integer("contributor_welcome_seen", { mode: "boolean" }).default(false), // Phase 2: tracks if graduation banner has been dismissed
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Clients (care recipients)
export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  dateOfBirth: text("date_of_birth"),
  primaryCondition: text("primary_condition"),
  allergies: text("allergies"), // JSON array of { name, severity: 'mild'|'serious'|'life-threatening' }
  diagnoses: text("diagnoses"), // JSON array of { name, severity: 'managed'|'serious'|'critical', dateNoted }
  assistiveDevices: text("assistive_devices"), // JSON array of { device, notes }
  notes: text("notes"),
  caregiverId: integer("caregiver_id").notNull(),
  primaryContactId: integer("primary_contact_id"), // user id of primary family contact
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  appMode: text("app_mode").default("caregiver"), // 'caregiver' | 'precare'
  isPractice: integer("is_practice", { mode: "boolean" }).default(false), // CG sample/practice client
  isShowcase: integer("is_showcase", { mode: "boolean" }).default(false), // CG has opted to show to potential families
  clientUserId: integer("client_user_id"), // user.id of the client if they have a portal account (self_care role)
  ownershipTransferInitiatedAt: text("ownership_transfer_initiated_at"), // ISO timestamp when transfer was first initiated (either side)
  ownershipTransferConfirmedAt: text("ownership_transfer_confirmed_at"), // ISO timestamp when transfer fully completed
  // Phase 3 — Transfer of Care
  transferInitiatedBy: text("transfer_initiated_by"), // 'mc' | 'client' — who started it
  transferStep: integer("transfer_step").default(0), // 0=none, 1=offered/step1, 2=step2 (client-initiated 24hr gate), 3=final
  transferMCCoConfirmed: integer("transfer_mc_co_confirmed", { mode: "boolean" }).default(false), // MC co-signed to waive 48hr wait
  transferOfferedAt: text("transfer_offered_at"), // ISO — when MC sent 'You Are Ready' offer (for 72hr expiry)
  transferStep2At: text("transfer_step2_at"), // ISO — when client completed step 2 (client-initiated path)
  transferCancelledAt: text("transfer_cancelled_at"), // ISO — if cancelled before completion
  mcPostTransferRole: text("mc_post_transfer_role"), // 'monitor' | 'step_back' | 'remove' — client's choice after transfer
  // Phase 2 — minor contributor approval gate
  requiresMinorApproval: integer("requires_minor_approval", { mode: "boolean" }).default(false), // MC toggle: true = pending entries held for review (minor clients only)
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Scheduled events: appointments, medications, therapy, tasks
export const scheduleEvents = sqliteTable("schedule_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(), // 'appointment' | 'medication' | 'therapy' | 'task' | 'other'
  scheduledAt: text("scheduled_at").notNull(), // ISO datetime
  recurrence: text("recurrence"), // 'none' | 'daily' | 'weekly' | 'monthly'
  notes: text("notes"),
  priority: text("priority").notNull().default("green"), // 'red' | 'yellow' | 'green'
  isCompleted: integer("is_completed", { mode: "boolean" }).default(false),
  completedAt: text("completed_at"),
  completedByUserId: integer("completed_by_user_id"),
  location: text("location"),
  reminderMinutes: integer("reminder_minutes").default(30),
  alarmEnabled: integer("alarm_enabled", { mode: "boolean" }).default(false),
  caregiverResponsible: integer("caregiver_responsible", { mode: "boolean" }).default(true), // false = family is handling
  responsibilityNote: text("responsibility_note"), // required when caregiverResponsible is false
});

export const insertScheduleEventSchema = createInsertSchema(scheduleEvents).omit({ id: true });
export type InsertScheduleEvent = z.infer<typeof insertScheduleEventSchema>;
export type ScheduleEvent = typeof scheduleEvents.$inferSelect;

// Activity logs: daily care entries (checked off items with priority)
export const activityLogs = sqliteTable("activity_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  loggedByUserId: integer("logged_by_user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("green"), // 'red' | 'yellow' | 'green'
  category: text("category").notNull().default("general"), // 'medication' | 'hygiene' | 'meal' | 'mood' | 'medical' | 'general'
  loggedAt: text("logged_at").notNull(),
  voiceNoteUrl: text("voice_note_url"),
  isChecked: integer("is_checked", { mode: "boolean" }).default(false),
  scheduleEventId: integer("schedule_event_id"), // link to a schedule item if from checklist
  // Late-entry flag system
  isLateEntry: integer("is_late_entry", { mode: "boolean" }).default(false),
  isExcused: integer("is_excused", { mode: "boolean" }).default(false),
  excuseNote: text("excuse_note"),
  excusedByUserId: integer("excused_by_user_id"),
  scheduledAt: text("scheduled_at"), // the time the entry was *supposed* to be logged (from schedule event)
  // Family / off-shift entry fields
  loggedByRole: text("logged_by_role"),   // 'caregiver' | 'primary_family' | 'secondary_family'
  isOffShiftEntry: integer("is_off_shift_entry", { mode: "boolean" }).default(false),
  isEmergency: integer("is_emergency", { mode: "boolean" }).default(false),
  emergencyType: text("emergency_type"),  // 'fall' | 'er_visit' | 'hospital_admission' | 'medical_event' | 'other'
  notes: text("notes"),                  // additional notes from MC
  // Phase 2 — Contributor (self_care) entries
  pendingReview: integer("pending_review", { mode: "boolean" }).default(false), // true when minor contributor's entry awaits MC approval
  approvedByUserId: integer("approved_by_user_id"), // MC who approved this entry
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Chat threads / groups
export const chatThreads = sqliteTable("chat_threads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  name: text("name").notNull(),
  members: text("members").notNull(), // JSON array of user IDs
  createdByUserId: integer("created_by_user_id").notNull(),
  isOpen: integer("is_open", { mode: "boolean" }).default(true),
  createdAt: text("created_at").notNull(),
});

export const insertChatThreadSchema = createInsertSchema(chatThreads).omit({ id: true });
export type InsertChatThread = z.infer<typeof insertChatThreadSchema>;
export type ChatThread = typeof chatThreads.$inferSelect;

// Messages in a chat thread
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("thread_id").notNull(),
  senderId: integer("sender_id").notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("text"), // 'text' | 'voice' | 'photo' | 'video'
  mediaUrl: text("media_url"),
  priority: text("priority").default("green"),
  sentAt: text("sent_at").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).default(false),
  readAt: text("read_at"), // ISO datetime when message was opened/read
  readByUserIds: text("read_by_user_ids").default("[]"), // JSON array of user IDs who have read it
});

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Media uploads (photos, videos)
export const mediaItems = sqliteTable("media_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  uploadedByUserId: integer("uploaded_by_user_id").notNull(),
  type: text("type").notNull(), // 'photo' | 'video'
  url: text("url").notNull(),
  caption: text("caption"),
  voiceNoteText: text("voice_note_text"),
  priority: text("priority").default("green"),
  uploadedAt: text("uploaded_at").notNull(),
});

export const insertMediaItemSchema = createInsertSchema(mediaItems).omit({ id: true });
export type InsertMediaItem = z.infer<typeof insertMediaItemSchema>;
export type MediaItem = typeof mediaItems.$inferSelect;

// Notifications
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  clientId: integer("client_id"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull(), // 'schedule' | 'activity' | 'message' | 'media' | 'alert'
  priority: text("priority").default("green"),
  isRead: integer("is_read", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
  linkTo: text("link_to"), // route to navigate to
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Archive summaries (AI-generated)
export const archiveSummaries = sqliteTable("archive_summaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  period: text("period").notNull(), // 'day' | 'week' | 'month' | 'year'
  periodLabel: text("period_label").notNull(), // e.g. "April 24, 2026" or "Week of April 20"
  summaryText: text("summary_text").notNull(),
  summaryTextMedical: text("summary_text_medical"), // clinical/professional version
  highlights: text("highlights"), // JSON array of key events
  generatedAt: text("generated_at").notNull(),
});

export const insertArchiveSummarySchema = createInsertSchema(archiveSummaries).omit({ id: true });
export type InsertArchiveSummary = z.infer<typeof insertArchiveSummarySchema>;
export type ArchiveSummary = typeof archiveSummaries.$inferSelect;

// Miscellaneous Notes — non-medical observations (household, equipment, safety, etc.)
export const miscNotes = sqliteTable("misc_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  authorId: integer("author_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull().default("other"), // 'household' | 'equipment' | 'safety' | 'other'
  isPinned: integer("is_pinned", { mode: "boolean" }).default(false),
  isResolved: integer("is_resolved", { mode: "boolean" }).default(false),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull(),
});

export const insertMiscNoteSchema = createInsertSchema(miscNotes).omit({ id: true });
export type InsertMiscNote = z.infer<typeof insertMiscNoteSchema>;
export type MiscNote = typeof miscNotes.$inferSelect;

// Document Vault
export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(), // 'insurance' | 'legal' | 'medical' | 'financial' | 'personal' | 'other'
  description: text("description"),
  fileType: text("file_type").notNull().default("pdf"), // 'pdf' | 'image' | 'doc'
  uploadedByUserId: integer("uploaded_by_user_id").notNull(),
  uploadedAt: text("uploaded_at").notNull(),
  isConfidential: integer("is_confidential", { mode: "boolean" }).default(false),
  cgAccess: text("cg_access").default("none"), // 'none' | 'read' | 'full'
});
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// Document Access Log — tracks when CG views/downloads a document
export const documentAccessLog = sqliteTable("document_access_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  docId: integer("doc_id").notNull(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(), // 'view' | 'download'
  accessedAt: text("accessed_at").notNull(),
});
export const insertDocumentAccessLogSchema = createInsertSchema(documentAccessLog).omit({ id: true });
export type InsertDocumentAccessLog = z.infer<typeof insertDocumentAccessLogSchema>;
export type DocumentAccessLog = typeof documentAccessLog.$inferSelect;

// Caregiver Shifts — clock in/out
export const shifts = sqliteTable("shifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caregiverId: integer("caregiver_id").notNull(),
  clientId: integer("client_id").notNull(),
  clockedInAt: text("clocked_in_at").notNull(),  // ISO datetime
  clockedOutAt: text("clocked_out_at"),           // null = currently on shift
  notes: text("notes"),
});
export const insertShiftSchema = createInsertSchema(shifts).omit({ id: true });
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shifts.$inferSelect;

// Care Flags — yellow and red flags for rating system
export const careFlags = sqliteTable("care_flags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  caregiverId: integer("caregiver_id").notNull(),
  flagType: text("flag_type").notNull(),      // 'yellow' | 'red'
  category: text("category").notNull(),       // 'medication' | 'appointment' | 'messages'
  reason: text("reason").notNull(),           // human-readable description
  referenceId: integer("reference_id"),       // scheduleEvent.id or message.id that triggered it
  referenceType: text("reference_type"),      // 'schedule_event' | 'message' | 'activity_log'
  triggeredAt: text("triggered_at").notNull(),
  isExcused: integer("is_excused", { mode: "boolean" }).default(false),
  excuseNote: text("excuse_note"),
  excusedByUserId: integer("excused_by_user_id"),
  excusedAt: text("excused_at"),
});
export const insertCareFlagSchema = createInsertSchema(careFlags).omit({ id: true });
export type InsertCareFlag = z.infer<typeof insertCareFlagSchema>;
export type CareFlag = typeof careFlags.$inferSelect;

// Outings / Location Sharing
export const outings = sqliteTable("outings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  caregiverId: integer("caregiver_id").notNull(),
  type: text("type").notNull(), // 'lunch' | 'shopping' | 'doctor' | 'drive' | 'errands' | 'other'
  note: text("note"),
  status: text("status").notNull().default("active"), // 'active' | 'completed'
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  durationMinutes: integer("duration_minutes"),
  lastLatitude: real("last_latitude"),
  lastLongitude: real("last_longitude"),
  lastLocationLabel: text("last_location_label"),
});
export const insertOutingSchema = createInsertSchema(outings).omit({ id: true });
export type InsertOuting = z.infer<typeof insertOutingSchema>;
export type Outing = typeof outings.$inferSelect;

// ── Vitals & Bodily Functions ─────────────────────────────────────────────────
export const vitals = sqliteTable("vitals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  caregiverId: integer("caregiver_id").notNull(),
  recordedAt: text("recorded_at").notNull(),

  // Vital signs
  bloodPressureSystolic: integer("bp_systolic"),
  bloodPressureDiastolic: integer("bp_diastolic"),
  heartRate: integer("heart_rate"),           // bpm
  temperature: real("temperature"),            // °F
  oxygenSaturation: integer("oxygen_sat"),    // %
  weight: real("weight"),                      // lbs
  bloodGlucose: integer("blood_glucose"),     // mg/dL
  painLevel: integer("pain_level"),           // 0–10

  // Bodily functions
  bowelMovement: integer("bowel_movement", { mode: "boolean" }),
  bowelNotes: text("bowel_notes"),            // 'normal' | 'loose' | 'hard' | 'other'
  urination: integer("urination", { mode: "boolean" }),
  urinationNotes: text("urination_notes"),    // 'normal' | 'dark' | 'frequent' | 'other'
  fluidIntake: integer("fluid_intake"),       // oz

  // Mood & cognition snapshot
  mood: text("mood"),                         // 'calm' | 'anxious' | 'confused' | 'agitated' | 'happy' | 'sad'
  cognitionLevel: text("cognition_level"),    // 'oriented' | 'mild_confusion' | 'moderate_confusion' | 'unresponsive'

  notes: text("notes"),
  // Phase 2 — Contributor (self_care) entries
  pendingReview: integer("pending_review", { mode: "boolean" }).default(false), // true when minor contributor's entry awaits MC approval
  approvedByUserId: integer("approved_by_user_id"), // MC who approved this entry
  recordedByUserId: integer("recorded_by_user_id"), // if self_care, the user who entered the vitals
});
export const insertVitalsSchema = createInsertSchema(vitals).omit({ id: true });
export type InsertVitals = z.infer<typeof insertVitalsSchema>;
export type Vitals = typeof vitals.$inferSelect;

// ── Medications ───────────────────────────────────────────────────────────────
export const medications = sqliteTable("medications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),

  // Identity
  name: text("name").notNull(),
  genericName: text("generic_name"),
  form: text("form").notNull().default("tablet"), // tablet|capsule|liquid|patch|injection|inhaler|drops|other
  dosageAmount: real("dosage_amount").notNull(),
  dosageUnit: text("dosage_unit").notNull().default("mg"), // mg|mcg|ml|units|%|other
  strength: text("strength"),                    // e.g. "10mg/5ml" for liquids

  // Schedule
  scheduleType: text("schedule_type").notNull().default("scheduled"), // scheduled|as_needed
  frequency: text("frequency"),                  // once_daily|twice_daily|three_daily|four_daily|weekly|biweekly|monthly|other
  scheduledTimes: text("scheduled_times"),        // JSON: ["08:00","20:00"]
  frequencyNote: text("frequency_note"),          // e.g. "with meals"

  // Prescriber / pharmacy
  prescribingPhysician: text("prescribing_physician"),
  pharmacy: text("pharmacy"),
  refillDate: text("refill_date"),
  rxNumber: text("rx_number"),

  // Purpose / instructions
  purpose: text("purpose"),                       // e.g. "Blood pressure control"
  instructions: text("instructions"),             // e.g. "Take with food"
  sideEffectsToWatch: text("side_effects_to_watch"),

  // Status
  status: text("status").notNull().default("active"), // active|discontinued
  startDate: text("start_date"),
  discontinuedDate: text("discontinued_date"),
  discontinuedReason: text("discontinued_reason"), // side_effects|completed|replaced|physician_order|other
  discontinuedNote: text("discontinued_note"),
  replacedById: integer("replaced_by_id"),        // FK to another medication if replaced

  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const insertMedicationSchema = createInsertSchema(medications).omit({ id: true });
export type InsertMedication = z.infer<typeof insertMedicationSchema>;
export type Medication = typeof medications.$inferSelect;

// ── Medication Dose History (for edits/changes over time) ─────────────────────
export const medicationHistory = sqliteTable("medication_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  medicationId: integer("medication_id").notNull(),
  changedAt: text("changed_at").notNull(),
  changedByUserId: integer("changed_by_user_id").notNull(),
  fieldChanged: text("field_changed").notNull(),  // e.g. "dosageAmount", "scheduledTimes"
  oldValue: text("old_value"),
  newValue: text("new_value"),
  note: text("note"),
});
export const insertMedicationHistorySchema = createInsertSchema(medicationHistory).omit({ id: true });
export type InsertMedicationHistory = z.infer<typeof insertMedicationHistorySchema>;
export type MedicationHistory = typeof medicationHistory.$inferSelect;

// ── Medication Logs (dose administration records) ─────────────────────────────
export const medicationLogs = sqliteTable("medication_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  medicationId: integer("medication_id").notNull(),
  clientId: integer("client_id").notNull(),
  caregiverId: integer("caregiver_id").notNull(),
  loggedAt: text("logged_at").notNull(),
  scheduledTime: text("scheduled_time"),          // ISO — what time it was supposed to be given
  wasGiven: integer("was_given", { mode: "boolean" }).notNull().default(true),
  refusedOrMissed: integer("refused_or_missed", { mode: "boolean" }).default(false),
  refusalReason: text("refusal_reason"),          // client_refused|caregiver_error|out_of_stock|other
  prnReason: text("prn_reason"),                  // for as_needed doses: why it was given
  reaction: text("reaction"),                     // any noted reaction after administration
  notes: text("notes"),
});
export const insertMedicationLogSchema = createInsertSchema(medicationLogs).omit({ id: true });
export type InsertMedicationLog = z.infer<typeof insertMedicationLogSchema>;
export type MedicationLog = typeof medicationLogs.$inferSelect;

// ── Badge System ──────────────────────────────────────────────────────────────

// Monthly family survey responses — one response set per caregiver per client per month
export const badgeSurveys = sqliteTable("badge_surveys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caregiverId: integer("caregiver_id").notNull(),
  clientId: integer("client_id").notNull(),
  submittedByUserId: integer("submitted_by_user_id").notNull(), // Primary FC
  submittedAt: text("submitted_at").notNull(),
  periodMonth: text("period_month").notNull(), // e.g. "2026-04" — one survey per caregiver per month

  // Communication dimension (0–5 scale each)
  commClarity: integer("comm_clarity"),       // Q: Updates are clear and easy to understand
  commResponsive: integer("comm_responsive"), // Q: Responds promptly when I reach out
  commProactive: integer("comm_proactive"),   // Q: Shares updates without being asked

  // Dependability dimension
  depReliable: integer("dep_reliable"),       // Q: Shows up consistently and on time
  depFollowThrough: integer("dep_follow_through"), // Q: Follows through on what they say

  // Knowledge dimension
  knwCompetence: integer("knw_competence"),   // Q: Handles care tasks with skill and confidence
  knwSituational: integer("knw_situational"), // Q: Responds well to unexpected situations

  // Connection dimension
  conHappiness: integer("con_happiness"),     // Q: My loved one seems happy when caregiver is present
  conWarmth: integer("con_warmth"),           // Q: Caregiver treats my loved one with warmth and dignity
  conPersonhood: integer("con_personhood"),   // Q: Caregiver sees my loved one as a person, not just a patient
  conAboveAndBeyond: integer("con_above_beyond"), // Q: Goes beyond tasks to make my loved one feel valued
  conFamilyConfidence: integer("con_family_confidence"), // Q: I feel confident and at peace when caregiver is on shift

  notes: text("notes"), // optional free-text comment from family
});
export const insertBadgeSurveySchema = createInsertSchema(badgeSurveys).omit({ id: true });
export type InsertBadgeSurvey = z.infer<typeof insertBadgeSurveySchema>;
export type BadgeSurvey = typeof badgeSurveys.$inferSelect;

// Computed badge scores — cached per caregiver per client, recomputed on demand
export const badgeScores = sqliteTable("badge_scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caregiverId: integer("caregiver_id").notNull(),
  clientId: integer("client_id").notNull(),
  computedAt: text("computed_at").notNull(),

  // Dimension scores 0–100
  communicationScore: real("communication_score"),
  dependabilityScore: real("dependability_score"),
  knowledgeScore: real("knowledge_score"),
  connectionScore: real("connection_score"),

  // Overall score 0–100
  overallScore: real("overall_score"),

  // Hearts display (0.0–5.0, derived from overallScore)
  heartsOverall: real("hearts_overall"),
  heartsCommunication: real("hearts_communication"),
  heartsDependability: real("hearts_dependability"),
  heartsKnowledge: real("hearts_knowledge"),
  heartsConnection: real("hearts_connection"),

  // Objective sub-scores stored for transparency
  objCommResponseSpeed: real("obj_comm_response_speed"),   // 0–100
  objCommQuality: real("obj_comm_quality"),                 // 0–100 AI-scored
  objCommParticipation: real("obj_comm_participation"),     // 0–100
  objDepShiftAccuracy: real("obj_dep_shift_accuracy"),      // 0–100
  objDepFlagScore: real("obj_dep_flag_score"),              // 0–100
  objDepAppointments: real("obj_dep_appointments"),         // 0–100
  objKnwMedication: real("obj_knw_medication"),             // 0–100
  objKnwVitals: real("obj_knw_vitals"),                     // 0–100
  objConPortalSignals: real("obj_con_portal_signals"),      // 0–100 (outings+logs+media+notes)

  // Data sufficiency
  portalDaysActive: integer("portal_days_active"),  // days of data in window
  hasMinimumData: integer("has_minimum_data", { mode: "boolean" }).default(false), // 14+ days required
  surveysInWindow: integer("surveys_in_window").default(0),
});
export const insertBadgeScoreSchema = createInsertSchema(badgeScores).omit({ id: true });
export type InsertBadgeScore = z.infer<typeof insertBadgeScoreSchema>;
export type BadgeScore = typeof badgeScores.$inferSelect;

// ── A Collection of Thoughts ────────────────────────────────────────────
// Caregiver-only journal of memories, stories, and musings shared by the client.
// Locked from family view during active care. Unlocked by caregiver at end of care
// as a gift to the family.
export const thoughtEntries = sqliteTable("thought_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  recordedByUserId: integer("recorded_by_user_id").notNull(), // caregiver who captured it

  // Content
  title: text("title"),                        // optional short title / label
  body: text("body").notNull(),                 // the thought, memory, or story
  voiceNoteUrl: text("voice_note_url"),         // future: audio recording URL
  voiceTranscript: text("voice_transcript"),    // future: transcribed text

  // Metadata
  mood: text("mood"),                           // 'reflective' | 'joyful' | 'nostalgic' | 'peaceful' | 'humorous' | 'bittersweet'
  tags: text("tags"),                           // JSON: ["family","childhood","faith"] etc.
  entryType: text("entry_type").notNull().default("text"), // 'text' | 'voice'

  recordedAt: text("recorded_at").notNull(),    // when the caregiver logged it
  editedAt: text("edited_at"),                  // last edit timestamp

  // Unlock system
  isUnlocked: integer("is_unlocked", { mode: "boolean" }).default(false),
  unlockedAt: text("unlocked_at"),
  unlockedByUserId: integer("unlocked_by_user_id"),
  unlockNote: text("unlock_note"),              // optional message from caregiver to family
});
export const insertThoughtEntrySchema = createInsertSchema(thoughtEntries).omit({ id: true });
export type InsertThoughtEntry = z.infer<typeof insertThoughtEntrySchema>;
export type ThoughtEntry = typeof thoughtEntries.$inferSelect;

// ── Care Scope — per-client, per-caregiver module toggles ───────────────────
// Family (Primary FC) controls which modules are active. Inactive modules are
// excluded from scoring AND do not generate flags. Caregiver can request changes.
export const careScopes = sqliteTable("care_scopes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  caregiverId: integer("caregiver_id").notNull(),

  // Module toggles — all true by default
  medications: integer("medications", { mode: "boolean" }).default(true),  // Track medication administration
  vitals: integer("vitals", { mode: "boolean" }).default(true),            // Track vitals & bodily functions
  appointments: integer("appointments", { mode: "boolean" }).default(true), // Track appointment completion
  activityLog: integer("activity_log", { mode: "boolean" }).default(true), // Always on — cannot disable
  messaging: integer("messaging", { mode: "boolean" }).default(true),      // Always on — cannot disable

  // Reason for any deactivation (shown to caregiver)
  medicationsNote: text("medications_note"),
  vitalsNote: text("vitals_note"),
  appointmentsNote: text("appointments_note"),

  // Scope change request from caregiver (awaiting family approval)
  pendingRequest: text("pending_request"), // JSON: { module, requestedState, reason }

  updatedAt: text("updated_at").notNull(),
  updatedByUserId: integer("updated_by_user_id"),
});
export const insertCareScopeSchema = createInsertSchema(careScopes).omit({ id: true });
export type InsertCareScope = z.infer<typeof insertCareScopeSchema>;
export type CareScope = typeof careScopes.$inferSelect;

// ── Caregiver Public Profile (Deployment 4 — Public Directory) ───────────────
// Each caregiver builds one profile that powers their public directory listing.
export const caregiverProfiles = sqliteTable("caregiver_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique(),      // FK → users.id

  // Identity
  photoUrl: text("photo_url"),
  displayName: text("display_name"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),

  // Bio sections
  carePhilosophy: text("care_philosophy"),            // free text, ~200 words
  aboutMe: text("about_me"),                          // short intro

  // Experience
  yearsExperience: integer("years_experience"),
  specialties: text("specialties"),                   // JSON: ["dementia","ALS","post-op"]
  careTypes: text("care_types"),                      // JSON: ["companion","personal","skilled"]
  livesIn: integer("lives_in", { mode: "boolean" }).default(false), // live-in available?
  hourlyAvailable: integer("hourly_available", { mode: "boolean" }).default(true),

  // Education & credentials
  education: text("education"),                       // free text
  certifications: text("certifications"),             // JSON: ["CNA","CPR","First Aid"]

  // Availability
  availableDays: text("available_days"),              // JSON: ["Mon","Tue","Wed"]
  availableHours: text("available_hours"),            // e.g. "7am–7pm"
  availableStartDate: text("available_start_date"),   // ISO date

  // Service area
  travelDistance: text("travel_distance"),             // e.g. "Up to 25 miles from Nashville, TN"

  // Custom caregiver-added tags (free-form additions beyond preset options)
  customSpecialties: text("custom_specialties"),       // JSON: ["tag1", "tag2"]
  customCertifications: text("custom_certifications"), // JSON: ["tag1"]

  // Languages
  languages: text("languages"),                       // JSON: ["English","Spanish"]

  // Visibility
  isPublic: integer("is_public", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const insertCaregiverProfileSchema = createInsertSchema(caregiverProfiles).omit({ id: true });
export type InsertCaregiverProfile = z.infer<typeof insertCaregiverProfileSchema>;
export type CaregiverProfile = typeof caregiverProfiles.$inferSelect;

// ── Flag Control — per-client, per-caregiver category-level flag toggles ──────
// Primary FC can disable flagging for specific categories without disabling the
// module entirely. Caregiver is NOT penalized for events in disabled categories.
// Separate from scope: scope=off → no tracking required; flagControl=off →
// tracking still expected, but missed events won't generate a flag.
export const flagControls = sqliteTable("flag_controls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  caregiverId: integer("caregiver_id").notNull(),

  // Per-category flag toggles — all true (active) by default
  medicationFlags: integer("medication_flags", { mode: "boolean" }).default(true),
  appointmentFlags: integer("appointment_flags", { mode: "boolean" }).default(true),
  messageFlags: integer("message_flags", { mode: "boolean" }).default(true),

  // Optional notes shown to caregiver explaining why a category is disabled
  medicationFlagsNote: text("medication_flags_note"),
  appointmentFlagsNote: text("appointment_flags_note"),
  messageFlagsNote: text("message_flags_note"),

  updatedAt: text("updated_at").notNull(),
  updatedByUserId: integer("updated_by_user_id"),
});
export const insertFlagControlSchema = createInsertSchema(flagControls).omit({ id: true });
export type InsertFlagControl = z.infer<typeof insertFlagControlSchema>;
export type FlagControl = typeof flagControls.$inferSelect;

// ── Caregiver Wellbeing — "Care for the Caregiver" ───────────────────────────

// A single wellbeing check-in session — "Need a Friend" conversation
export const wellbeingCheckIns = sqliteTable("wellbeing_check_ins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),           // caregiver
  clientId: integer("client_id"),                 // optional context

  // What the caregiver typed
  caregiverMessage: text("caregiver_message").notNull(),

  // AI-generated response (text)
  aiResponse: text("ai_response"),

  // Emotional context detected by AI
  detectedMood: text("detected_mood"),            // 'exhausted' | 'grieving' | 'stressed' | 'overwhelmed' | 'lonely' | 'proud' | 'hopeful' | 'grateful'
  detectedTheme: text("detected_theme"),          // 'family_stress' | 'difficult_family' | 'client_decline' | 'personal_crisis' | 'burnout' | 'triumph' | 'general'

  // How it was triggered
  triggerType: text("trigger_type").notNull().default("manual"), // 'manual' | 'proactive_shift_end' | 'proactive_trend'

  // Mood rating (optional, from mood monitor)
  moodRating: integer("mood_rating"),             // 1–5 (1=very hard, 5=doing great)

  // Whether TTS was played
  audioPlayed: integer("audio_played", { mode: "boolean" }).default(false),

  createdAt: text("created_at").notNull(),
});
export const insertWellbeingCheckInSchema = createInsertSchema(wellbeingCheckIns).omit({ id: true });
export type InsertWellbeingCheckIn = z.infer<typeof insertWellbeingCheckInSchema>;
export type WellbeingCheckIn = typeof wellbeingCheckIns.$inferSelect;

// Streak / perk tracking — one row per caregiver
export const wellbeingStreaks = sqliteTable("wellbeing_streaks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique(),
  currentStreak: integer("current_streak").default(0),   // consecutive days checked in
  longestStreak: integer("longest_streak").default(0),
  totalCheckIns: integer("total_check_ins").default(0),
  lastCheckInDate: text("last_check_in_date"),           // ISO date "2026-05-01"
  earnedBadges: text("earned_badges").default("[]"),     // JSON: ["first_checkin","week_streak","month_streak"]
});
export const insertWellbeingStreakSchema = createInsertSchema(wellbeingStreaks).omit({ id: true });
export type InsertWellbeingStreak = z.infer<typeof insertWellbeingStreakSchema>;
export type WellbeingStreak = typeof wellbeingStreaks.$inferSelect;

// ── Care Net University — lesson completion tracking ────────────────────────
// One row per caregiver per lesson completed
export const universityProgress = sqliteTable("university_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  lessonId: text("lesson_id").notNull(),           // e.g. "cg_01", "cg_02"
  trackId: text("track_id").notNull(),             // "caregiver" | "family"
  knowledgePoints: integer("knowledge_points").notNull().default(0),
  completedAt: text("completed_at").notNull(),
});
export const insertUniversityProgressSchema = createInsertSchema(universityProgress).omit({ id: true });
export type InsertUniversityProgress = z.infer<typeof insertUniversityProgressSchema>;
export type UniversityProgress = typeof universityProgress.$inferSelect;

// ── Pattern Recognition Engine ─────────────────────────────────────────────

// Tags extracted from care log entries by the auto-tagger
export const observationTags = sqliteTable("observation_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  sourceType: text("source_type").notNull(), // 'activity_log' | 'vitals' | 'medication_log'
  sourceId: integer("source_id").notNull(),  // FK to the source row
  observedAt: text("observed_at").notNull(), // ISO datetime of the observation
  category: text("category").notNull(),      // 'symptom' | 'activity' | 'food' | 'sleep' | 'mood' | 'vital'
  tag: text("tag").notNull(),               // e.g. 'headache' | 'dizziness' | 'walk' | 'poor_appetite'
  severity: text("severity").default("mild"), // 'mild' | 'moderate' | 'severe'
  rawText: text("raw_text"),                // the original phrase that produced this tag
  createdAt: text("created_at").notNull(),
});
export const insertObservationTagSchema = createInsertSchema(observationTags).omit({ id: true });
export type InsertObservationTag = z.infer<typeof insertObservationTagSchema>;
export type ObservationTag = typeof observationTags.$inferSelect;

// Detected patterns — one row per unique pattern per client
export const healthPatterns = sqliteTable("health_patterns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),

  // What the pattern is
  patternKey: text("pattern_key").notNull(),       // e.g. 'headache_after_medication'
  label: text("label").notNull(),                  // human-readable: "Headache after Morning Medications"
  description: text("description").notNull(),      // full observation sentence
  symptomTag: text("symptom_tag").notNull(),       // e.g. 'headache'
  correlatedWith: text("correlated_with"),         // JSON: [{type:'medication',name:'Lisinopril',id:3}]
  severity: text("severity").notNull().default("moderate"), // 'mild' | 'moderate' | 'severe'

  // Threshold tracking
  occurrenceCount: integer("occurrence_count").notNull().default(0),
  consecutiveDays: integer("consecutive_days").notNull().default(0),
  windowDays: integer("window_days").notNull().default(14), // how many days back we looked
  firstSeenAt: text("first_seen_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),

  // Alert thresholds fired
  alert3DayFiredAt: text("alert_3day_fired_at"),   // null = not yet fired
  alert7DayFiredAt: text("alert_7day_fired_at"),
  alert3xWeekFiredAt: text("alert_3x_week_fired_at"),
  alert6x2WeekFiredAt: text("alert_6x_2week_fired_at"),

  // Status
  status: text("status").notNull().default("active"), // 'active' | 'dismissed' | 'escalated' | 'resolved'
  dismissedAt: text("dismissed_at"),
  dismissedByUserId: integer("dismissed_by_user_id"),
  dismissedUntil: text("dismissed_until"),         // auto-resurface after this date
  resolvedAt: text("resolved_at"),                 // when symptom stopped appearing
  escalatedAt: text("escalated_at"),
  escalatedByUserId: integer("escalated_by_user_id"),

  // Doctor note
  doctorNoteText: text("doctor_note_text"),        // pre-drafted note
  doctorNoteSentAt: text("doctor_note_sent_at"),
  doctorNoteSentByUserId: integer("doctor_note_sent_by_user_id"),

  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const insertHealthPatternSchema = createInsertSchema(healthPatterns).omit({ id: true });
export type InsertHealthPattern = z.infer<typeof insertHealthPatternSchema>;
export type HealthPattern = typeof healthPatterns.$inferSelect;

// Pattern alert acknowledgements — one row per user per pattern alert
export const patternAcknowledgements = sqliteTable("pattern_acknowledgements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patternId: integer("pattern_id").notNull(),
  userId: integer("user_id").notNull(),
  alertLevel: text("alert_level").notNull(), // '3day' | '7day' | '3x_week' | '6x_2week' | 'manual'
  acknowledgedAt: text("acknowledged_at").notNull(),
});
export const insertPatternAcknowledgementSchema = createInsertSchema(patternAcknowledgements).omit({ id: true });
export type InsertPatternAcknowledgement = z.infer<typeof insertPatternAcknowledgementSchema>;
export type PatternAcknowledgement = typeof patternAcknowledgements.$inferSelect;

// MC pattern preferences — what they want surfaced and at what threshold
export const patternPreferences = sqliteTable("pattern_preferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique(),
  clientId: integer("client_id").notNull(),
  // Which categories to watch
  watchSymptoms: integer("watch_symptoms", { mode: "boolean" }).default(true),
  watchActivity: integer("watch_activity", { mode: "boolean" }).default(true),
  watchFood: integer("watch_food", { mode: "boolean" }).default(true),
  watchSleep: integer("watch_sleep", { mode: "boolean" }).default(true),
  watchVitals: integer("watch_vitals", { mode: "boolean" }).default(true),
  // Minimum threshold to receive a push notification
  // 'summary_only' | '3day' | '7day' | '3x_week' | '6x_2week' | 'severe_only'
  notifyThreshold: text("notify_threshold").default("3day"),
  updatedAt: text("updated_at").notNull(),
});
export const insertPatternPreferenceSchema = createInsertSchema(patternPreferences).omit({ id: true });
export type InsertPatternPreference = z.infer<typeof insertPatternPreferenceSchema>;
export type PatternPreference = typeof patternPreferences.$inferSelect;

// ── Becky Response Library ──────────────────────────────────────────────────
// Admin-only: Becky's bank of example prompts + authentic responses
export const beckyResponses = sqliteTable("becky_responses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  theme: text("theme").notNull(),            // e.g. "burnout", "client_decline", custom
  examplePrompt: text("example_prompt").notNull(),  // example caregiver message
  response: text("response").notNull(),      // Becky's response
  isPlaceholder: integer("is_placeholder").notNull().default(0), // 1 = needs Becky edit
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const insertBeckyResponseSchema = createInsertSchema(beckyResponses).omit({ id: true });
export type InsertBeckyResponse = z.infer<typeof insertBeckyResponseSchema>;
export type BeckyResponse = typeof beckyResponses.$inferSelect;

// ── Authentication ──────────────────────────────────────────────────────────

// Auth accounts — separate from the users table (which tracks portal roles)
// One authAccount links to one users row after approval
export const authAccounts = sqliteTable("auth_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  userId: integer("user_id"), // null until approved + confirmed
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  emailVerifyToken: text("email_verify_token"), // short-lived token
  emailVerifyExpiry: text("email_verify_expiry"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiry: text("password_reset_expiry"),
  createdAt: text("created_at").notNull(),
  lastLoginAt: text("last_login_at"),
});
export const insertAuthAccountSchema = createInsertSchema(authAccounts).omit({ id: true });
export type InsertAuthAccount = z.infer<typeof insertAuthAccountSchema>;
export type AuthAccount = typeof authAccounts.$inferSelect;

// Auth sessions — JWT stored server-side for revocation support
export const authSessions = sqliteTable("auth_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authAccountId: integer("auth_account_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(), // hashed JWT jti
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  revokedAt: text("revoked_at"), // null = active
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
});
export const insertAuthSessionSchema = createInsertSchema(authSessions).omit({ id: true });
export type InsertAuthSession = z.infer<typeof insertAuthSessionSchema>;
export type AuthSession = typeof authSessions.$inferSelect;

// Beta applications — intake questionnaire responses awaiting approval
// Help desk escalations — stored for learning / review in Becky Admin
export const helpdeskEscalations = sqliteTable("helpdesk_escalations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull(),
  userName: text("user_name"),
  userRole: text("user_role"),
  currentPage: text("current_page"),
  conversation: text("conversation").notNull(), // JSON array of {role, content, timestamp}
  resolved: integer("resolved", { mode: "boolean" }).default(false),
  resolution: text("resolution"),               // admin can note how it was resolved
  createdAt: text("created_at").notNull(),
});
export type HelpdeskEscalation = typeof helpdeskEscalations.$inferSelect;

export const betaApplications = sqliteTable("beta_applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'caregiver' | 'family' | 'both' | 'other' | 'self_managed'
  currentlyInCare: text("currently_in_care").notNull(), // 'yes' | 'no' | 'soon'
  intent: text("intent").notNull(), // free-text: why they want access
  agreedToConfidentiality: integer("agreed_to_confidentiality", { mode: "boolean" }).notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'denied'
  reviewedAt: text("reviewed_at"),
  reviewNote: text("review_note"), // optional internal note from admin
  inviteToken: text("invite_token"), // set when approved — used to create account
  inviteExpiry: text("invite_expiry"),
  inviteSentAt: text("invite_sent_at"),
  accountCreatedAt: text("account_created_at"), // set when they complete signup
  createdAt: text("created_at").notNull(),
});
export const insertBetaApplicationSchema = createInsertSchema(betaApplications).omit({ id: true });
export type InsertBetaApplication = z.infer<typeof insertBetaApplicationSchema>;
export type BetaApplication = typeof betaApplications.$inferSelect;

// ── Connection Invites ────────────────────────────────────────────────────────
// Tracks caregiver↔MC connection invites with unique tokens
export const connectionInvites = sqliteTable("connection_invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),           // unique URL token
  senderUserId: integer("sender_user_id").notNull(), // who created the invite
  senderRole: text("sender_role").notNull(),         // 'caregiver' | 'primary_family'
  clientId: integer("client_id"),                   // client the invite is for (if known)
  clientName: text("client_name"),                  // display name for the landing page
  senderName: text("sender_name").notNull(),        // display name for the landing page
  invitedEmail: text("invited_email"),              // optional: pre-filled recipient email
  inviteType: text("invite_type").notNull(),        // 'caregiver_to_mc' | 'mc_to_caregiver' | 'mc_to_family' | 'mc_to_self_cg'
  status: text("status").notNull().default("pending"), // 'pending' | 'accepted' | 'expired'
  acceptedByUserId: integer("accepted_by_user_id"),
  acceptedAt: text("accepted_at"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});
export const insertConnectionInviteSchema = createInsertSchema(connectionInvites).omit({ id: true });
export type InsertConnectionInvite = z.infer<typeof insertConnectionInviteSchema>;
export type ConnectionInvite = typeof connectionInvites.$inferSelect;
