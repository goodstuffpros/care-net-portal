import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  users, clients, scheduleEvents, activityLogs, chatThreads,
  messages, mediaItems, notifications, archiveSummaries, miscNotes,
  documents, outings, shifts, careFlags, vitals,
  medications, medicationHistory, medicationLogs,
  badgeSurveys, badgeScores,
  thoughtEntries, caregiverProfiles, careScopes, flagControls,
  wellbeingCheckIns, wellbeingStreaks, universityProgress, beckyResponses,
  type WellbeingCheckIn, type InsertWellbeingCheckIn,
  type WellbeingStreak, type InsertWellbeingStreak,
  type UniversityProgress, type InsertUniversityProgress,
  type BeckyResponse, type InsertBeckyResponse,
  type ThoughtEntry, type InsertThoughtEntry,
  type CaregiverProfile, type InsertCaregiverProfile,
  type CareScope, type InsertCareScope,
  type FlagControl, type InsertFlagControl,
  type User, type InsertUser,
  type Client, type InsertClient,
  type ScheduleEvent, type InsertScheduleEvent,
  type ActivityLog, type InsertActivityLog,
  type ChatThread, type InsertChatThread,
  type Message, type InsertMessage,
  type MediaItem, type InsertMediaItem,
  type Notification, type InsertNotification,
  type ArchiveSummary, type InsertArchiveSummary,
  type MiscNote, type InsertMiscNote,
  type Document, type InsertDocument,
  type Outing, type InsertOuting,
  type Shift, type InsertShift,
  type CareFlag, type InsertCareFlag,
  type Vitals, type InsertVitals,
  type Medication, type InsertMedication,
  type MedicationHistory, type InsertMedicationHistory,
  type MedicationLog, type InsertMedicationLog,
} from "@shared/schema";

import { db, sqlite } from "./db";

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    avatar_initials TEXT,
    client_id INTEGER,
    notification_prefs TEXT DEFAULT '{"all":true}',
    is_active INTEGER DEFAULT 1,
    onboarding_completed_at TEXT,
    temp_access_start TEXT,
    temp_access_end TEXT,
    temp_access_reason TEXT
  );
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date_of_birth TEXT,
    primary_condition TEXT,
    allergies TEXT,
    notes TEXT,
    caregiver_id INTEGER NOT NULL,
    primary_contact_id INTEGER,
    is_active INTEGER DEFAULT 1,
    app_mode TEXT DEFAULT 'caregiver'
  );
  CREATE TABLE IF NOT EXISTS schedule_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    recurrence TEXT,
    notes TEXT,
    priority TEXT NOT NULL DEFAULT 'green',
    is_completed INTEGER DEFAULT 0,
    completed_at TEXT,
    completed_by_user_id INTEGER,
    location TEXT,
    reminder_minutes INTEGER DEFAULT 30
  );
  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    logged_by_user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'green',
    category TEXT NOT NULL DEFAULT 'general',
    logged_at TEXT NOT NULL,
    voice_note_url TEXT,
    is_checked INTEGER DEFAULT 0,
    schedule_event_id INTEGER
  );
  CREATE TABLE IF NOT EXISTS chat_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    members TEXT NOT NULL,
    created_by_user_id INTEGER NOT NULL,
    is_open INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    media_url TEXT,
    priority TEXT DEFAULT 'green',
    sent_at TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    read_at TEXT,
    read_by_user_ids TEXT DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS media_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    uploaded_by_user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    caption TEXT,
    voice_note_text TEXT,
    priority TEXT DEFAULT 'green',
    uploaded_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    client_id INTEGER,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL,
    priority TEXT DEFAULT 'green',
    is_read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    link_to TEXT
  );
  CREATE TABLE IF NOT EXISTS archive_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    period TEXT NOT NULL,
    period_label TEXT NOT NULL,
    summary_text TEXT NOT NULL,
    summary_text_medical TEXT,
    highlights TEXT,
    generated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS misc_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    is_pinned INTEGER DEFAULT 0,
    is_resolved INTEGER DEFAULT 0,
    resolved_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    file_type TEXT NOT NULL DEFAULT 'pdf',
    uploaded_by_user_id INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL,
    is_confidential INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS outings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    caregiver_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_minutes INTEGER,
    last_latitude REAL,
    last_longitude REAL,
    last_location_label TEXT
  );
  CREATE TABLE IF NOT EXISTS medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    generic_name TEXT,
    form TEXT NOT NULL DEFAULT 'tablet',
    dosage_amount REAL NOT NULL,
    dosage_unit TEXT NOT NULL DEFAULT 'mg',
    strength TEXT,
    schedule_type TEXT NOT NULL DEFAULT 'scheduled',
    frequency TEXT,
    scheduled_times TEXT,
    frequency_note TEXT,
    prescribing_physician TEXT,
    pharmacy TEXT,
    refill_date TEXT,
    rx_number TEXT,
    purpose TEXT,
    instructions TEXT,
    side_effects_to_watch TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    start_date TEXT,
    discontinued_date TEXT,
    discontinued_reason TEXT,
    discontinued_note TEXT,
    replaced_by_id INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS medication_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id INTEGER NOT NULL,
    changed_at TEXT NOT NULL,
    changed_by_user_id INTEGER NOT NULL,
    field_changed TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    note TEXT
  );
  CREATE TABLE IF NOT EXISTS medication_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    caregiver_id INTEGER NOT NULL,
    logged_at TEXT NOT NULL,
    scheduled_time TEXT,
    was_given INTEGER NOT NULL DEFAULT 1,
    refused_or_missed INTEGER DEFAULT 0,
    refusal_reason TEXT,
    prn_reason TEXT,
    reaction TEXT,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS vitals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    caregiver_id INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    bp_systolic INTEGER,
    bp_diastolic INTEGER,
    heart_rate INTEGER,
    temperature REAL,
    oxygen_sat INTEGER,
    weight REAL,
    blood_glucose INTEGER,
    pain_level INTEGER,
    bowel_movement INTEGER,
    bowel_notes TEXT,
    urination INTEGER,
    urination_notes TEXT,
    fluid_intake INTEGER,
    mood TEXT,
    cognition_level TEXT,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS badge_surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caregiver_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    submitted_by_user_id INTEGER NOT NULL,
    submitted_at TEXT NOT NULL,
    period_month TEXT NOT NULL,
    comm_clarity INTEGER,
    comm_responsive INTEGER,
    comm_proactive INTEGER,
    dep_reliable INTEGER,
    dep_follow_through INTEGER,
    knw_competence INTEGER,
    knw_situational INTEGER,
    con_happiness INTEGER,
    con_warmth INTEGER,
    con_personhood INTEGER,
    con_above_beyond INTEGER,
    con_family_confidence INTEGER,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS thought_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    recorded_by_user_id INTEGER NOT NULL,
    title TEXT,
    body TEXT NOT NULL,
    voice_note_url TEXT,
    voice_transcript TEXT,
    mood TEXT,
    tags TEXT,
    entry_type TEXT NOT NULL DEFAULT 'text',
    recorded_at TEXT NOT NULL,
    edited_at TEXT,
    is_unlocked INTEGER DEFAULT 0,
    unlocked_at TEXT,
    unlocked_by_user_id INTEGER,
    unlock_note TEXT
  );
  CREATE TABLE IF NOT EXISTS badge_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caregiver_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    computed_at TEXT NOT NULL,
    communication_score REAL,
    dependability_score REAL,
    knowledge_score REAL,
    connection_score REAL,
    overall_score REAL,
    hearts_overall REAL,
    hearts_communication REAL,
    hearts_dependability REAL,
    hearts_knowledge REAL,
    hearts_connection REAL,
    obj_comm_response_speed REAL,
    obj_comm_quality REAL,
    obj_comm_participation REAL,
    obj_dep_shift_accuracy REAL,
    obj_dep_flag_score REAL,
    obj_dep_appointments REAL,
    obj_knw_medication REAL,
    obj_knw_vitals REAL,
    obj_con_portal_signals REAL,
    portal_days_active INTEGER,
    has_minimum_data INTEGER DEFAULT 0,
    surveys_in_window INTEGER DEFAULT 0
  );
`);

// Safe migration: add onboarding_completed_at column if it doesn't exist yet
try { sqlite.exec(`ALTER TABLE users ADD COLUMN onboarding_completed_at TEXT`); } catch { /* column already exists */ }
// Safe migrations: caregiver_profiles new columns
try { sqlite.exec(`ALTER TABLE caregiver_profiles ADD COLUMN travel_distance TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE caregiver_profiles ADD COLUMN custom_specialties TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE caregiver_profiles ADD COLUMN custom_certifications TEXT`); } catch {}
// Safe migrations: activity_logs family/off-shift fields
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN logged_by_role TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN is_off_shift_entry INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN is_emergency INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN emergency_type TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN notes TEXT`); } catch {}
// Safe migrations: activity_logs late entry fields (may be missing in older DBs)
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN is_late_entry INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN is_excused INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN excuse_note TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN excused_by_user_id INTEGER`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN scheduled_at TEXT`); } catch {}

// ── Care Scope table (per-client module toggles) ──────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS care_scopes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    caregiver_id INTEGER NOT NULL,
    medications INTEGER DEFAULT 1,
    vitals INTEGER DEFAULT 1,
    appointments INTEGER DEFAULT 1,
    activity_log INTEGER DEFAULT 1,
    messaging INTEGER DEFAULT 1,
    medications_note TEXT,
    vitals_note TEXT,
    appointments_note TEXT,
    pending_request TEXT,
    updated_at TEXT NOT NULL,
    updated_by_user_id INTEGER
  );
`);

// Caregiver public profiles table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS caregiver_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    photo_url TEXT,
    display_name TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    care_philosophy TEXT,
    about_me TEXT,
    years_experience INTEGER,
    specialties TEXT,
    care_types TEXT,
    lives_in INTEGER DEFAULT 0,
    hourly_available INTEGER DEFAULT 1,
    education TEXT,
    certifications TEXT,
    available_days TEXT,
    available_hours TEXT,
    available_start_date TEXT,
    languages TEXT,
    is_public INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT
  );
`);

// Flag control table — per-category flag on/off for Primary FC
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS flag_controls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    caregiver_id INTEGER NOT NULL,
    medication_flags INTEGER DEFAULT 1,
    appointment_flags INTEGER DEFAULT 1,
    message_flags INTEGER DEFAULT 1,
    medication_flags_note TEXT,
    appointment_flags_note TEXT,
    message_flags_note TEXT,
    updated_at TEXT NOT NULL,
    updated_by_user_id INTEGER
  );
  CREATE TABLE IF NOT EXISTS wellbeing_check_ins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    client_id INTEGER,
    caregiver_message TEXT NOT NULL,
    ai_response TEXT,
    detected_mood TEXT,
    detected_theme TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'manual',
    mood_rating INTEGER,
    audio_played INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS becky_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    theme TEXT NOT NULL,
    example_prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    is_placeholder INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS university_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    lesson_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    knowledge_points INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS wellbeing_streaks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_check_ins INTEGER DEFAULT 0,
    last_check_in_date TEXT,
    earned_badges TEXT DEFAULT '[]'
  );
`);

// ── Auth tables ──────────────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS auth_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    user_id INTEGER,
    email_verified INTEGER DEFAULT 0,
    email_verify_token TEXT,
    email_verify_expiry TEXT,
    password_reset_token TEXT,
    password_reset_expiry TEXT,
    last_login_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    auth_account_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT
  );
  CREATE TABLE IF NOT EXISTS beta_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    currently_in_care TEXT NOT NULL,
    intent TEXT NOT NULL,
    agreed_to_confidentiality INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_at TEXT,
    review_note TEXT,
    invite_token TEXT,
    invite_expiry TEXT,
    invite_sent_at TEXT,
    account_created_at TEXT,
    created_at TEXT NOT NULL
  );
`);

export interface IStorage {
  // Users
  getUsers(): User[];
  getUserById(id: number): User | undefined;
  getUsersByClientId(clientId: number): User[];
  createUser(data: InsertUser): User;
  updateUser(id: number, data: Partial<InsertUser>): User | undefined;

  // Clients
  getClients(): Client[];
  getClientById(id: number): Client | undefined;
  createClient(data: InsertClient): Client;
  updateClient(id: number, data: Partial<InsertClient>): Client | undefined;

  // Schedule Events
  getScheduleEventsByClient(clientId: number): ScheduleEvent[];
  getScheduleEventById(id: number): ScheduleEvent | undefined;
  createScheduleEvent(data: InsertScheduleEvent): ScheduleEvent;
  updateScheduleEvent(id: number, data: Partial<InsertScheduleEvent>): ScheduleEvent | undefined;
  deleteScheduleEvent(id: number): void;

  // Activity Logs
  getActivityLogsByClient(clientId: number): ActivityLog[];
  createActivityLog(data: InsertActivityLog): ActivityLog;
  updateActivityLog(id: number, data: Partial<InsertActivityLog>): ActivityLog | undefined;
  deleteActivityLog(id: number): void;
  excuseActivityLog(id: number, excuseNote: string, excusedByUserId: number): ActivityLog | undefined;

  // Chat Threads
  getChatThreadsByClient(clientId: number): ChatThread[];
  getChatThreadById(id: number): ChatThread | undefined;
  createChatThread(data: InsertChatThread): ChatThread;
  updateChatThread(id: number, data: Partial<InsertChatThread>): ChatThread | undefined;

  // Messages
  getMessagesByThread(threadId: number): Message[];
  createMessage(data: InsertMessage): Message;
  markMessageRead(messageId: number, userId: number): Message | undefined;

  // Media
  getMediaByClient(clientId: number): MediaItem[];
  createMediaItem(data: InsertMediaItem): MediaItem;
  deleteMediaItem(id: number): void;

  // Notifications
  getNotificationsByUser(userId: number): Notification[];
  createNotification(data: InsertNotification): Notification;
  markNotificationRead(id: number): void;
  markAllNotificationsRead(userId: number): void;

  // Archive
  getArchiveSummariesByClient(clientId: number): ArchiveSummary[];
  createArchiveSummary(data: InsertArchiveSummary): ArchiveSummary;

  // Caregiver profiles
  getCaregiversByClientId(clientId: number): User[];

  // Misc Notes
  getMiscNotesByClient(clientId: number): MiscNote[];
  createMiscNote(data: InsertMiscNote): MiscNote;
  updateMiscNote(id: number, data: Partial<InsertMiscNote>): MiscNote | undefined;
  deleteMiscNote(id: number): void;

  // Documents
  getDocumentsByClient(clientId: number): Document[];
  createDocument(data: InsertDocument): Document;
  deleteDocument(id: number): void;

  // Outings
  getOutingsByClient(clientId: number): Outing[];
  getActiveOutingByClient(clientId: number): Outing | undefined;
  createOuting(data: InsertOuting): Outing;
  updateOuting(id: number, data: Partial<InsertOuting>): Outing | undefined;

  // Shifts
  getShiftsByCaregiver(caregiverId: number): Shift[];
  getActiveShift(caregiverId: number, clientId: number): Shift | undefined;
  clockIn(caregiverId: number, clientId: number): Shift;
  clockOut(shiftId: number): Shift | undefined;

  // Care Flags
  getCareFlagsByClient(clientId: number): CareFlag[];
  getCareFlagsByCaregiver(caregiverId: number, clientId: number): CareFlag[];
  createCareFlag(data: InsertCareFlag): CareFlag;
  excuseCareFlag(id: number, excuseNote: string, excusedByUserId: number): CareFlag | undefined;
  getUnexcusedFlagCount(caregiverId: number, clientId: number, category: string, since: string): number;
  getRatingScore(caregiverId: number, clientId: number): number;

  // Vitals
  getVitalsByClient(clientId: number, limit?: number): Vitals[];
  getLatestVitals(clientId: number): Vitals | undefined;
  createVitals(data: InsertVitals): Vitals;

  // Medications
  getMedicationsByClient(clientId: number, status?: string): Medication[];
  getMedicationById(id: number): Medication | undefined;
  createMedication(data: InsertMedication): Medication;
  updateMedication(id: number, data: Partial<InsertMedication>, changedByUserId: number, changeNote?: string): Medication | undefined;
  discontinueMedication(id: number, reason: string, note: string, date: string, changedByUserId: number): Medication | undefined;
  getMedicationHistory(medicationId: number): MedicationHistory[];
  getMedicationLogs(clientId: number, limit?: number): MedicationLog[];
  getMedicationLogsByMed(medicationId: number, limit?: number): MedicationLog[];
  createMedicationLog(data: InsertMedicationLog): MedicationLog;

  // Thoughts
  getThoughtsByClient(clientId: number): ThoughtEntry[];
  createThought(data: InsertThoughtEntry): ThoughtEntry;
  updateThought(id: number, data: Partial<InsertThoughtEntry>): ThoughtEntry | undefined;
  deleteThought(id: number): void;
  unlockAllThoughts(clientId: number, unlockedByUserId: number, unlockNote?: string): void;
  isCollectionUnlocked(clientId: number): boolean;

  // Caregiver Profiles
  getCaregiverProfile(userId: number): CaregiverProfile | undefined;
  upsertCaregiverProfile(userId: number, data: Partial<InsertCaregiverProfile>): CaregiverProfile | undefined;
  getPublicCaregiverProfiles(): CaregiverProfile[];

  // Care Scope
  getCareScope(clientId: number, caregiverId: number): CareScope | undefined;
  upsertCareScope(clientId: number, caregiverId: number, data: Partial<InsertCareScope>, updatedByUserId: number): CareScope;
  getDefaultScope(): Omit<CareScope, 'id' | 'clientId' | 'caregiverId' | 'updatedAt' | 'updatedByUserId'>;

  // Flag Control
  getFlagControl(clientId: number, caregiverId: number): FlagControl | undefined;
  upsertFlagControl(clientId: number, caregiverId: number, data: Partial<InsertFlagControl>, updatedByUserId: number): FlagControl;
  getDefaultFlagControl(): Omit<FlagControl, 'id' | 'clientId' | 'caregiverId' | 'updatedAt' | 'updatedByUserId'>;

  // Wellbeing
  createWellbeingCheckIn(data: InsertWellbeingCheckIn): WellbeingCheckIn;
  getWellbeingCheckIns(userId: number, limit?: number): WellbeingCheckIn[];
  getWellbeingStreak(userId: number): WellbeingStreak | undefined;
  upsertWellbeingStreak(userId: number): WellbeingStreak;
  getRecentUrgentFlagCount(userId: number, clientId: number, hoursBack?: number): number;

  // University
  completeLesson(userId: number, lessonId: string, trackId: string, knowledgePoints: number): UniversityProgress;
  getCompletedLessons(userId: number): UniversityProgress[];
  getTotalKnowledgePoints(userId: number): number;

  // Becky Response Library
  getBeckyResponses(theme?: string): BeckyResponse[];
  getBeckyResponseById(id: number): BeckyResponse | undefined;
  createBeckyResponse(data: InsertBeckyResponse): BeckyResponse;
  updateBeckyResponse(id: number, data: Partial<InsertBeckyResponse>): BeckyResponse | undefined;
  deleteBeckyResponse(id: number): void;
  getResponsesForTheme(theme: string): BeckyResponse[];
  seedBeckyResponsesIfEmpty(): void;
}

function seedIfEmpty() {
  const existingUsers = db.select().from(users).all();
  if (existingUsers.length > 0) return;

  const now = new Date().toISOString();
  const today = new Date();

  // Seed users (id 1=Becky caregiver, 2=Marcus multi-caregiver, 3=Diana temp, 4=Robert Jr primary, 5=Linda secondary, 6=Sarah primary, 7=Tom secondary, 8=Maria facilitator)
  db.insert(users).values([
    { name: "Becky M.", role: "caregiver", email: "becky@carenportal.com", phone: "555-0101", avatarInitials: "BM", clientId: 1, notificationPrefs: '{"all":true}', isActive: true },
    { name: "Marcus T.", role: "multi_caregiver", email: "marcus.t@carenportal.com", phone: "555-0110", avatarInitials: "MT", clientId: 1, notificationPrefs: '{"all":true}', isActive: true },
    { name: "Diana P.", role: "temp_caregiver", email: "diana.p@carenportal.com", phone: "555-0111", avatarInitials: "DP", clientId: 1, notificationPrefs: '{"all":true}', isActive: true, tempAccessStart: new Date().toISOString().split('T')[0], tempAccessEnd: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0], tempAccessReason: "vacation" },
    { name: "Robert Johnson Jr.", role: "primary_family", email: "robert.jr@email.com", phone: "555-0102", avatarInitials: "RJ", clientId: 1, notificationPrefs: '{"all":true}', isActive: true },
    { name: "Linda Johnson", role: "secondary_family", email: "linda.j@email.com", phone: "555-0103", avatarInitials: "LJ", clientId: 1, notificationPrefs: '{"medications":true,"alerts":true}', isActive: true },
    { name: "Sarah Williams", role: "primary_family", email: "sarah.w@email.com", phone: "555-0104", avatarInitials: "SW", clientId: 2, notificationPrefs: '{"all":true}', isActive: true },
    { name: "Tom Williams", role: "secondary_family", email: "tom.w@email.com", phone: "555-0105", avatarInitials: "TW", clientId: 2, notificationPrefs: '{"alerts":true}', isActive: true },
    { name: "Maria G.", role: "facilitator", email: "maria.g@email.com", phone: "555-0112", avatarInitials: "MG", clientId: 3, notificationPrefs: '{"all":true}', isActive: true },
    { name: "James G.", role: "secondary_family", email: "james.g@email.com", phone: "555-0113", avatarInitials: "JG", clientId: 3, notificationPrefs: '{"alerts":true}', isActive: true },
  ]).run();

  // Seed clients
  db.insert(clients).values([
    { name: "Robert Johnson", dateOfBirth: "1942-03-15", primaryCondition: "Post-stroke recovery, mild cognitive impairment", allergies: '["Penicillin","Sulfa drugs"]', notes: "Prefers morning routines early. Enjoys classical music. Has a small dog named Max.", caregiverId: 1, primaryContactId: 4, isActive: true, appMode: "caregiver" },
    { name: "Eleanor Williams", dateOfBirth: "1938-11-22", primaryCondition: "Parkinson's disease, Type 2 diabetes", allergies: '["Shellfish","Aspirin"]', notes: "Very independent spirit. Needs reminders but resists help. Loves gardening conversation.", caregiverId: 1, primaryContactId: 6, isActive: true, appMode: "caregiver" },
    { name: "Frank Garcia", dateOfBirth: "1948-06-10", primaryCondition: "Post-surgery recovery, mild arthritis", allergies: '["NSAIDs"]', notes: "Recently discharged from hospital. Family managing care together before hiring a caregiver.", caregiverId: 8, primaryContactId: 8, isActive: true, appMode: "precare" },
  ]).run();

  const d = (offsetHours: number) => {
    const d = new Date(today);
    d.setHours(d.getHours() + offsetHours);
    return d.toISOString();
  };

  const dateAt = (hour: number, offsetDays = 0) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  // Seed schedule events for client 1
  db.insert(scheduleEvents).values([
    { clientId: 1, title: "Morning Medications", type: "medication", scheduledAt: dateAt(8), recurrence: "daily", notes: "Lisinopril 10mg, Aspirin 81mg, Metformin 500mg", priority: "red", isCompleted: true, completedAt: dateAt(8, 0), completedByUserId: 1, reminderMinutes: 15 },
    { clientId: 1, title: "Physical Therapy Session", type: "therapy", scheduledAt: dateAt(10), recurrence: "weekly", notes: "Focus on left arm mobility. Ice pack after session.", priority: "yellow", isCompleted: false, reminderMinutes: 30 },
    { clientId: 1, title: "Dr. Chen Neurologist Appointment", type: "appointment", scheduledAt: dateAt(14, 3), recurrence: "none", notes: "Bring medication list. Parking at west entrance.", priority: "red", isCompleted: false, location: "St. Mary's Medical Center, Suite 402", reminderMinutes: 60 },
    { clientId: 1, title: "Evening Medications", type: "medication", scheduledAt: dateAt(20), recurrence: "daily", notes: "Metformin 500mg, Amlodipine 5mg", priority: "red", isCompleted: false, reminderMinutes: 15 },
    { clientId: 1, title: "Afternoon Walk", type: "task", scheduledAt: dateAt(15), recurrence: "daily", notes: "15-20 minutes, use walker, stay on flat paths", priority: "green", isCompleted: true, completedAt: dateAt(15), completedByUserId: 1, reminderMinutes: 10 },
    { clientId: 1, title: "Occupational Therapy", type: "therapy", scheduledAt: dateAt(11, 2), recurrence: "weekly", notes: "Fine motor skills and daily living activities", priority: "yellow", isCompleted: false, reminderMinutes: 30 },
  ]).run();

  // Seed schedule events for client 2
  db.insert(scheduleEvents).values([
    { clientId: 2, title: "Morning Medications", type: "medication", scheduledAt: dateAt(7, 0), recurrence: "daily", notes: "Carbidopa-levodopa, Metformin, check blood sugar first", priority: "red", isCompleted: true, completedAt: dateAt(7), completedByUserId: 1, reminderMinutes: 15 },
    { clientId: 2, title: "Blood Sugar Check", type: "task", scheduledAt: dateAt(7, 0), recurrence: "daily", notes: "Target range 80-130 mg/dL before meals", priority: "yellow", isCompleted: true, completedAt: dateAt(7), completedByUserId: 1, reminderMinutes: 5 },
    { clientId: 2, title: "Speech Therapy", type: "therapy", scheduledAt: dateAt(13, 1), recurrence: "weekly", notes: "Swallowing exercises and voice projection", priority: "yellow", isCompleted: false, reminderMinutes: 30 },
  ]).run();

  // Seed activity logs for client 1
  db.insert(activityLogs).values([
    { clientId: 1, loggedByUserId: 1, title: "Morning medications administered", description: "All morning meds taken without issue. Robert was cooperative and in good spirits.", priority: "green", category: "medication", loggedAt: dateAt(8, 0), isChecked: true },
    { clientId: 1, loggedByUserId: 1, title: "Fall risk incident", description: "Robert attempted to get up from chair unassisted. Reminded him to use call button. No injury but worth monitoring. Left side weakness more pronounced today.", priority: "red", category: "medical", loggedAt: dateAt(9, 0), isChecked: true },
    { clientId: 1, loggedByUserId: 1, title: "Breakfast - good appetite", description: "Ate scrambled eggs and toast. Drank 8oz orange juice. Seemed happy and chatty.", priority: "green", category: "meal", loggedAt: dateAt(8, 0), isChecked: true },
    { clientId: 1, loggedByUserId: 1, title: "Afternoon walk completed", description: "15-minute walk in hallway. Used walker properly. Some fatigue by the end but pushed through well.", priority: "green", category: "general", loggedAt: dateAt(15, 0), isChecked: true },
    { clientId: 1, loggedByUserId: 1, title: "Complained of mild headache", description: "Mild headache reported around 2pm. Offered Tylenol per PRN order. Resolved within an hour. Blood pressure checked: 138/84.", priority: "yellow", category: "medical", loggedAt: dateAt(14, 0), isChecked: true },
    { clientId: 1, loggedByUserId: 1, title: "Physical therapy session", description: "PT went well. Robert worked on left arm exercises. Showed improvement in grip strength compared to last week.", priority: "green", category: "general", loggedAt: dateAt(10, 0), isChecked: true },
  ]).run();

  // Seed activity logs for client 2
  db.insert(activityLogs).values([
    { clientId: 2, loggedByUserId: 1, title: "Morning medications given", description: "All meds administered. Blood sugar was 118 mg/dL - within target range.", priority: "green", category: "medication", loggedAt: dateAt(7, 0), isChecked: true },
    { clientId: 2, loggedByUserId: 1, title: "Tremors increased mid-morning", description: "Eleanor's tremors were noticeably worse around 10am, approximately 3 hours after last Parkinson's medication. Documented for Dr. Patel review.", priority: "yellow", category: "medical", loggedAt: dateAt(10, 0), isChecked: true },
    { clientId: 2, loggedByUserId: 1, title: "Refused lunch assistance", description: "Eleanor insisted on eating independently. Took longer than usual but ate most of the meal. Small spill, cleaned up. Important for her dignity and independence.", priority: "green", category: "meal", loggedAt: dateAt(12, 0), isChecked: true },
  ]).run();

  // Seed chat threads
  db.insert(chatThreads).values([
    { clientId: 1, name: "Robert's Care Team", members: '[1,2,3]', createdByUserId: 1, isOpen: true, createdAt: dateAt(9, -5) },
    { clientId: 1, name: "Urgent Updates", members: '[1,2]', createdByUserId: 1, isOpen: true, createdAt: dateAt(9, -2) },
    { clientId: 2, name: "Eleanor's Care Team", members: '[1,4,5]', createdByUserId: 1, isOpen: true, createdAt: dateAt(9, -3) },
  ]).run();

  // Seed messages
  db.insert(messages).values([
    { threadId: 1, senderId: 1, content: "Good morning team. Robert had a great night. He slept well and is in good spirits this morning.", messageType: "text", priority: "green", sentAt: dateAt(8, 0), isRead: true },
    { threadId: 1, senderId: 2, content: "Thanks for the update Becky! Does he need anything from us for his appointment Thursday?", messageType: "text", priority: "green", sentAt: dateAt(9, 0), isRead: true },
    { threadId: 1, senderId: 1, content: "Please bring his insurance card and I have the medication list ready. I'll send photos of his current medications later today.", messageType: "text", priority: "green", sentAt: dateAt(9, 0), isRead: false },
    { threadId: 2, senderId: 1, content: "⚠️ Just a heads up - Robert tried to stand without his walker this morning. No injury, but we should discuss adding more reminders around his chair.", messageType: "text", priority: "yellow", sentAt: dateAt(9, 0), isRead: false },
    { threadId: 3, senderId: 1, content: "Eleanor is doing well today. Blood sugar was great at 118. She's been more talkative than usual - asked about her garden.", messageType: "text", priority: "green", sentAt: dateAt(8, 0), isRead: true },
    { threadId: 3, senderId: 4, content: "That's wonderful to hear! She loves her roses. Maybe we could bring some fresh flowers next visit?", messageType: "text", priority: "green", sentAt: dateAt(10, 0), isRead: true },
  ]).run();

  // Seed media items
  db.insert(mediaItems).values([
    { clientId: 1, uploadedByUserId: 1, type: "photo", url: "https://images.unsplash.com/photo-1447452001602-7090c7ab2db3?w=400", caption: "Robert enjoying his morning coffee and newspaper today. Great mood!", voiceNoteText: "He asked about the baseball scores and was happy to hear his team won.", priority: "green", uploadedAt: dateAt(8, -1) },
    { clientId: 1, uploadedByUserId: 2, type: "photo", url: "https://images.unsplash.com/photo-1509822929464-92b5704d0f77?w=400", caption: "Family visit on Sunday. Dad was so happy to see the grandkids.", voiceNoteText: null, priority: "green", uploadedAt: dateAt(14, -2) },
    { clientId: 2, uploadedByUserId: 1, type: "photo", url: "https://images.unsplash.com/photo-1516562309708-05f3b2b2c238?w=400", caption: "Eleanor's PT exercises going well. Looking stronger each week.", voiceNoteText: "She completed all 3 sets today with minimal tremors.", priority: "green", uploadedAt: dateAt(11, -1) },
  ]).run();

  // Seed notifications for user 1 (caregiver)
  db.insert(notifications).values([
    { userId: 1, clientId: 1, title: "Medication Reminder", body: "Robert's evening medications are due in 30 minutes.", type: "schedule", priority: "red", isRead: false, createdAt: dateAt(19, 0), linkTo: "/schedule" },
    { userId: 1, clientId: 1, title: "New Message", body: "Robert Jr. sent a message in 'Urgent Updates'.", type: "message", priority: "yellow", isRead: false, createdAt: dateAt(9, 0), linkTo: "/messages" },
    { userId: 2, clientId: 1, title: "Activity Update", body: "Becky logged: Robert tried to stand without walker. No injury.", type: "activity", priority: "yellow", isRead: false, createdAt: dateAt(9, 0), linkTo: "/activity" },
    { userId: 2, clientId: 1, title: "Appointment Reminder", body: "Dr. Chen Neurologist appointment in 3 days at 2pm.", type: "schedule", priority: "red", isRead: true, createdAt: dateAt(8, -1), linkTo: "/schedule" },
  ]).run();

  // Seed misc notes
  db.insert(miscNotes).values([
    { clientId: 1, authorId: 1, title: "Evidence of rodents near kitchen", body: "Noticed droppings behind the refrigerator and near the pantry corner. Family should arrange pest control. I've placed the food in sealed containers as a precaution.", category: "household", isPinned: true, isResolved: false, createdAt: dateAt(9, -2) },
    { clientId: 1, authorId: 1, title: "Vacuum cleaner not working", body: "The upright vacuum stopped powering on. Tried different outlets — seems like the motor may have burned out. The home could use a replacement or repair before next deep clean.", category: "equipment", isPinned: false, isResolved: false, createdAt: dateAt(10, -1) },
    { clientId: 1, authorId: 2, title: "Bathroom grab bar is loose", body: "The grab bar next to the toilet has some wobble to it. With Robert's balance issues this could be a fall risk. A handyman should check it before the end of the week.", category: "safety", isPinned: true, isResolved: false, createdAt: dateAt(14, -3) },
    { clientId: 1, authorId: 1, title: "Hallway light bulb replaced", body: "The hallway light near the bedroom burned out. Replaced with a new LED bulb. Night navigation should be fine now.", category: "household", isPinned: false, isResolved: true, resolvedAt: dateAt(11, -4), createdAt: dateAt(8, -5) },
    { clientId: 2, authorId: 1, title: "Stove burner difficult to ignite", body: "The front-left burner on Eleanor's stove takes multiple attempts to light. Should be looked at by the property manager — she uses it for her morning tea.", category: "equipment", isPinned: false, isResolved: false, createdAt: dateAt(9, -1) },
  ]).run();

  // Seed archive summaries
  db.insert(archiveSummaries).values([
    {
      clientId: 1,
      period: "day",
      periodLabel: "Yesterday",
      summaryText: "Robert had a stable and generally positive day. Morning medications were administered on time, and he enjoyed breakfast with good appetite. A mild fall-risk incident was documented midmorning — he attempted to stand unassisted — but no injury occurred. His afternoon walk was completed successfully with the walker. A mild headache was reported and resolved with Tylenol. Physical therapy showed improved grip strength compared to the previous session.",
      highlights: '["Morning meds on time ✓","Fall risk incident (no injury) ⚠️","PT session - improved grip strength ✓","Headache resolved with Tylenol ✓","Afternoon walk completed ✓"]',
      generatedAt: dateAt(22, -1),
    },
    {
      clientId: 1,
      period: "week",
      periodLabel: "This Week",
      summaryText: "This week showed overall stability with Robert. Medication adherence was 100%. Two physical therapy sessions were completed with noted improvement in left-arm mobility. One fall-risk incident occurred and was documented and communicated to the family. Blood pressure readings remained slightly elevated (average 140/86) and has been communicated to Dr. Chen for the upcoming appointment. Robert's mood has been positive — he has been socializing more and engaging in conversation.",
      highlights: '["Medication adherence: 100%","2 PT sessions completed","1 fall risk incident documented","BP trend elevated - flagged for Dr. Chen","Mood: positive, increased social engagement"]',
      generatedAt: dateAt(20, 0),
    },
  ]).run();

  // Seed documents for client 1
  db.insert(documents).values([
    { clientId: 1, title: "Insurance Card — Medicare", category: "insurance", description: "Primary Medicare card, Part A & B", fileType: "pdf", uploadedByUserId: 1, uploadedAt: dateAt(10, -30), isConfidential: false },
    { clientId: 1, title: "Advance Directive", category: "legal", description: "Healthcare proxy and end-of-life wishes", fileType: "pdf", uploadedByUserId: 1, uploadedAt: dateAt(10, -60), isConfidential: true },
    { clientId: 1, title: "Power of Attorney", category: "legal", description: "Durable power of attorney — Robert Johnson Jr.", fileType: "doc", uploadedByUserId: 4, uploadedAt: dateAt(10, -45), isConfidential: true },
    { clientId: 1, title: "Hospital Discharge Summary", category: "medical", description: "St. Mary's discharge summary from March 2026", fileType: "pdf", uploadedByUserId: 1, uploadedAt: dateAt(10, -20), isConfidential: false },
    { clientId: 1, title: "Medicare Card (Supplemental)", category: "insurance", description: "Medigap supplement insurance card", fileType: "image", uploadedByUserId: 1, uploadedAt: dateAt(10, -15), isConfidential: false },
  ]).run();

  // Seed documents for client 2
  db.insert(documents).values([
    { clientId: 2, title: "Insurance Card", category: "insurance", description: "Blue Cross Blue Shield card", fileType: "image", uploadedByUserId: 1, uploadedAt: dateAt(10, -25), isConfidential: false },
    { clientId: 2, title: "DNR Order", category: "legal", description: "Do Not Resuscitate order on file", fileType: "pdf", uploadedByUserId: 6, uploadedAt: dateAt(10, -50), isConfidential: true },
    { clientId: 2, title: "Speech Therapy Referral", category: "medical", description: "Referral letter from Dr. Patel for speech therapy", fileType: "pdf", uploadedByUserId: 1, uploadedAt: dateAt(10, -10), isConfidential: false },
  ]).run();

  // Seed completed outings for client 1
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStart1 = new Date(yesterday); yStart1.setHours(12, 0, 0, 0);
  const yEnd1 = new Date(yesterday); yEnd1.setHours(13, 15, 0, 0);
  const yStart2 = new Date(yesterday); yStart2.setHours(15, 0, 0, 0);
  const yEnd2 = new Date(yesterday); yEnd2.setHours(15, 45, 0, 0);
  db.insert(outings).values([
    { clientId: 1, caregiverId: 1, type: "lunch", note: "Lunch at Robert's favorite diner. He enjoyed the soup.", status: "completed", startedAt: yStart1.toISOString(), endedAt: yEnd1.toISOString(), durationMinutes: 75, lastLatitude: 32.7767, lastLongitude: -96.7970, lastLocationLabel: "Main Street Diner, Dallas" },
    { clientId: 1, caregiverId: 1, type: "shopping", note: "Picked up prescriptions and some groceries.", status: "completed", startedAt: yStart2.toISOString(), endedAt: yEnd2.toISOString(), durationMinutes: 45, lastLatitude: 32.7810, lastLongitude: -96.8020, lastLocationLabel: "Walmart Pharmacy, Dallas" },
  ]).run();

  console.log("✅ Database seeded with sample data");
}

function seedVitalsIfEmpty() {
  const existing = db.select().from(vitals).limit(1).all();
  if (existing.length > 0) return;

  // Generate 14 days of realistic vitals for Robert Johnson (clientId=1, caregiverId=1)
  const now = new Date();
  const entries = [
    { daysAgo: 0, hour: 8,  bpS: 128, bpD: 82, hr: 74, temp: 98.4, o2: 97, wt: 182.5, bg: 118, pain: 2, bm: true,  bmN: "normal",  ur: true, urN: "normal",  fl: 24, mood: "calm",    cog: "oriented",       notes: "Morning vitals. Robert slept well. Good spirits." },
    { daysAgo: 1, hour: 8,  bpS: 132, bpD: 84, hr: 78, temp: 98.6, o2: 96, wt: 182.8, bg: 124, pain: 3, bm: false, bmN: null,     ur: true, urN: "normal",  fl: 20, mood: "calm",    cog: "oriented",       notes: "Complained of mild knee pain. Otherwise stable." },
    { daysAgo: 1, hour: 20, bpS: 126, bpD: 80, hr: 72, temp: 98.2, o2: 97, wt: null,  bg: 110, pain: 2, bm: true,  bmN: "normal",  ur: true, urN: "normal",  fl: 28, mood: "happy",   cog: "oriented",       notes: "Evening check. Watched the game, very happy." },
    { daysAgo: 2, hour: 8,  bpS: 138, bpD: 88, hr: 82, temp: 98.8, o2: 95, wt: 183.0, bg: 132, pain: 4, bm: false, bmN: null,     ur: true, urN: "dark",    fl: 16, mood: "anxious",  cog: "mild_confusion",  notes: "BP slightly elevated. Seemed confused about day of week. Encouraged fluids." },
    { daysAgo: 2, hour: 14, bpS: 134, bpD: 85, hr: 76, temp: 98.5, o2: 96, wt: null,  bg: 128, pain: 3, bm: true,  bmN: "normal",  ur: true, urN: "normal",  fl: 32, mood: "calm",    cog: "oriented",       notes: "Afternoon re-check after increased fluids. Improved." },
    { daysAgo: 3, hour: 8,  bpS: 124, bpD: 78, hr: 70, temp: 98.3, o2: 98, wt: 182.2, bg: 108, pain: 1, bm: true,  bmN: "normal",  ur: true, urN: "normal",  fl: 26, mood: "happy",   cog: "oriented",       notes: "Great morning. Best BP reading this week." },
    { daysAgo: 4, hour: 8,  bpS: 130, bpD: 83, hr: 75, temp: 98.5, o2: 97, wt: 182.5, bg: 115, pain: 2, bm: true,  bmN: "hard",    ur: true, urN: "normal",  fl: 22, mood: "calm",    cog: "oriented",       notes: "Bowel movement noted as hard. Added prune juice to lunch." },
    { daysAgo: 5, hour: 8,  bpS: 135, bpD: 86, hr: 80, temp: 98.7, o2: 96, wt: 183.2, bg: 129, pain: 3, bm: false, bmN: null,     ur: true, urN: "frequent", fl: 18, mood: "anxious",  cog: "oriented",       notes: "Frequent urination noted. Will monitor. BP slightly high." },
    { daysAgo: 6, hour: 8,  bpS: 126, bpD: 80, hr: 73, temp: 98.4, o2: 97, wt: 182.8, bg: 112, pain: 2, bm: true,  bmN: "normal",  ur: true, urN: "normal",  fl: 24, mood: "calm",    cog: "oriented",       notes: "Routine morning vitals. All within normal range." },
    { daysAgo: 7, hour: 8,  bpS: 129, bpD: 81, hr: 76, temp: 98.6, o2: 97, wt: 182.6, bg: 117, pain: 2, bm: true,  bmN: "normal",  ur: true, urN: "normal",  fl: 25, mood: "calm",    cog: "oriented",       notes: "One week checkpoint. Stable." },
    { daysAgo: 8, hour: 8,  bpS: 140, bpD: 90, hr: 85, temp: 99.1, o2: 94, wt: 183.5, bg: 138, pain: 5, bm: false, bmN: null,     ur: true, urN: "dark",    fl: 14, mood: "agitated", cog: "mild_confusion",  notes: "Elevated temp and BP. Seemed agitated. Notified family. Dr. Chen contacted." },
    { daysAgo: 9, hour: 8,  bpS: 134, bpD: 84, hr: 79, temp: 98.7, o2: 96, wt: 183.1, bg: 126, pain: 3, bm: true,  bmN: "normal",  ur: true, urN: "normal",  fl: 22, mood: "calm",    cog: "oriented",       notes: "Recovering from yesterday. BP coming down." },
    { daysAgo: 10, hour: 8, bpS: 127, bpD: 81, hr: 74, temp: 98.4, o2: 97, wt: 182.9, bg: 114, pain: 2, bm: true,  bmN: "normal",  ur: true, urN: "normal",  fl: 26, mood: "happy",   cog: "oriented",       notes: "Good day. Son visited in afternoon." },
    { daysAgo: 11, hour: 8, bpS: 131, bpD: 83, hr: 77, temp: 98.5, o2: 97, wt: 182.7, bg: 120, pain: 2, bm: true,  bmN: "normal",  ur: true, urN: "normal",  fl: 24, mood: "calm",    cog: "oriented",       notes: "Routine vitals. Stable." },
  ];

  for (const e of entries) {
    const d = new Date(now);
    d.setDate(d.getDate() - e.daysAgo);
    d.setHours(e.hour, 0, 0, 0);
    db.insert(vitals).values({
      clientId: 1,
      caregiverId: 1,
      recordedAt: d.toISOString(),
      bloodPressureSystolic: e.bpS,
      bloodPressureDiastolic: e.bpD,
      heartRate: e.hr,
      temperature: e.temp,
      oxygenSaturation: e.o2,
      weight: e.wt ?? undefined,
      bloodGlucose: e.bg,
      painLevel: e.pain,
      bowelMovement: e.bm,
      bowelNotes: e.bmN ?? undefined,
      urination: e.ur,
      urinationNotes: e.urN ?? undefined,
      fluidIntake: e.fl,
      mood: e.mood,
      cognitionLevel: e.cog,
      notes: e.notes,
    }).run();
  }
  console.log("✅ Vitals seeded");
}

function seedMedicationsIfEmpty() {
  const existing = db.select().from(medications).limit(1).all();
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const meds = [
    {
      clientId: 1, name: 'Lisinopril', genericName: 'Lisinopril',
      form: 'tablet', dosageAmount: 10, dosageUnit: 'mg',
      scheduleType: 'scheduled', frequency: 'once_daily',
      scheduledTimes: JSON.stringify(['08:00']),
      frequencyNote: 'Take in the morning',
      prescribingPhysician: 'Dr. Linda Chen', pharmacy: 'CVS Pharmacy',
      refillDate: nextMonth, rxNumber: 'RX-10482',
      purpose: 'Blood pressure control',
      instructions: 'Take with or without food. Avoid potassium supplements.',
      sideEffectsToWatch: 'Dry cough, dizziness, swelling of hands/feet',
      status: 'active', startDate: sixMonthsAgo,
      notes: 'BP has been well-controlled on this dose.',
      createdAt: now, updatedAt: now,
    },
    {
      clientId: 1, name: 'Metformin', genericName: 'Metformin HCl',
      form: 'tablet', dosageAmount: 500, dosageUnit: 'mg',
      scheduleType: 'scheduled', frequency: 'twice_daily',
      scheduledTimes: JSON.stringify(['08:00', '18:00']),
      frequencyNote: 'Take with meals',
      prescribingPhysician: 'Dr. Linda Chen', pharmacy: 'CVS Pharmacy',
      refillDate: nextMonth, rxNumber: 'RX-10483',
      purpose: 'Type 2 diabetes management',
      instructions: 'Always take with food to reduce GI upset.',
      sideEffectsToWatch: 'Nausea, diarrhea, stomach upset',
      status: 'active', startDate: sixMonthsAgo,
      notes: 'Glucose levels stable. Continue monitoring.',
      createdAt: now, updatedAt: now,
    },
    {
      clientId: 1, name: 'Atorvastatin', genericName: 'Atorvastatin',
      form: 'tablet', dosageAmount: 20, dosageUnit: 'mg',
      scheduleType: 'scheduled', frequency: 'once_daily',
      scheduledTimes: JSON.stringify(['20:00']),
      frequencyNote: 'Take in the evening',
      prescribingPhysician: 'Dr. Linda Chen', pharmacy: 'CVS Pharmacy',
      refillDate: nextMonth, rxNumber: 'RX-10484',
      purpose: 'Cholesterol management',
      instructions: 'Avoid grapefruit juice. Take at same time each day.',
      sideEffectsToWatch: 'Muscle pain or weakness, dark urine',
      status: 'active', startDate: threeMonthsAgo,
      notes: null,
      createdAt: now, updatedAt: now,
    },
    {
      clientId: 1, name: 'Tylenol', genericName: 'Acetaminophen',
      form: 'tablet', dosageAmount: 500, dosageUnit: 'mg',
      scheduleType: 'as_needed',
      frequency: null, scheduledTimes: null,
      frequencyNote: 'Max 4 doses per 24 hours. Do not exceed 2000mg/day.',
      prescribingPhysician: 'Dr. Linda Chen', pharmacy: 'CVS Pharmacy',
      refillDate: null, rxNumber: null,
      purpose: 'Pain and fever relief',
      instructions: 'Give for pain level 4 or above. Do not combine with other acetaminophen products.',
      sideEffectsToWatch: 'Liver damage with overuse',
      status: 'active', startDate: sixMonthsAgo,
      notes: 'Used primarily for knee pain. Log each use with pain level.',
      createdAt: now, updatedAt: now,
    },
    {
      clientId: 1, name: 'Aspirin', genericName: 'Aspirin',
      form: 'tablet', dosageAmount: 81, dosageUnit: 'mg',
      scheduleType: 'scheduled', frequency: 'once_daily',
      scheduledTimes: JSON.stringify(['08:00']),
      frequencyNote: 'Take with morning medications',
      prescribingPhysician: 'Dr. Linda Chen', pharmacy: 'CVS Pharmacy',
      refillDate: nextMonth, rxNumber: null,
      purpose: 'Cardiovascular protection / blood thinner',
      instructions: 'Take with food. Do not crush or chew enteric-coated tablet.',
      sideEffectsToWatch: 'Stomach bleeding, unusual bruising',
      status: 'active', startDate: sixMonthsAgo,
      notes: null,
      createdAt: now, updatedAt: now,
    },
    {
      // Discontinued med — demonstrates archive
      clientId: 1, name: 'Amlodipine', genericName: 'Amlodipine Besylate',
      form: 'tablet', dosageAmount: 5, dosageUnit: 'mg',
      scheduleType: 'scheduled', frequency: 'once_daily',
      scheduledTimes: JSON.stringify(['08:00']),
      frequencyNote: null,
      prescribingPhysician: 'Dr. Linda Chen', pharmacy: 'CVS Pharmacy',
      refillDate: null, rxNumber: 'RX-10477',
      purpose: 'Blood pressure control',
      instructions: 'Take in the morning.',
      sideEffectsToWatch: 'Ankle swelling, flushing',
      status: 'discontinued',
      startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      discontinuedDate: twoMonthsAgo,
      discontinuedReason: 'replaced',
      discontinuedNote: 'Replaced by Lisinopril per Dr. Chen order dated ' + twoMonthsAgo + '. Patient had persistent ankle edema on Amlodipine.',
      notes: null,
      createdAt: now, updatedAt: now,
    },
  ];

  for (const m of meds) {
    db.insert(medications).values(m as any).run();
  }

  // Seed a few dose logs for the last 3 days (morning meds)
  const logNow = new Date();
  for (let daysAgo = 0; daysAgo <= 2; daysAgo++) {
    const d = new Date(logNow);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(8, 5, 0, 0);
    // Log Lisinopril (id=1), Metformin morning (id=2), Aspirin (id=5)
    for (const medId of [1, 2, 5]) {
      db.insert(medicationLogs).values({
        medicationId: medId, clientId: 1, caregiverId: 1,
        loggedAt: d.toISOString(),
        scheduledTime: new Date(d.setHours(8, 0, 0, 0)).toISOString(),
        wasGiven: true, refusedOrMissed: false,
        notes: daysAgo === 0 ? 'Morning meds administered without issue.' : null,
      } as any).run();
    }
    // Evening meds (Metformin + Atorvastatin)
    const eve = new Date(logNow);
    eve.setDate(eve.getDate() - daysAgo);
    eve.setHours(20, 8, 0, 0);
    if (eve < logNow) {
      for (const medId of [2, 3]) {
        db.insert(medicationLogs).values({
          medicationId: medId, clientId: 1, caregiverId: 1,
          loggedAt: eve.toISOString(),
          scheduledTime: new Date(eve.setHours(20, 0, 0, 0)).toISOString(),
          wasGiven: true, refusedOrMissed: false, notes: null,
        } as any).run();
      }
    }
  }

  // One PRN Tylenol log
  const prnTime = new Date(logNow);
  prnTime.setDate(prnTime.getDate() - 1);
  prnTime.setHours(14, 30, 0, 0);
  db.insert(medicationLogs).values({
    medicationId: 4, clientId: 1, caregiverId: 1,
    loggedAt: prnTime.toISOString(),
    scheduledTime: null, wasGiven: true, refusedOrMissed: false,
    prnReason: 'Client reported knee pain 6/10 after physical therapy.',
    notes: 'Pain resolved to 3/10 within 45 minutes.',
  } as any).run();

  console.log('✅ Medications seeded');
}

seedIfEmpty();
seedVitalsIfEmpty();
seedMedicationsIfEmpty();
seedBadgeSurveyIfEmpty();
seedThoughtsIfEmpty();

function seedBadgeSurveyIfEmpty() {
  const existing = db.select().from(badgeSurveys).all();
  if (existing.length > 0) return;

  // Seed a realistic survey response from Robert Jr. (userId=4) for Becky (caregiverId=1, clientId=1)
  // All scores on 0–5 scale — Becky is excellent overall but survey reflects honest family perspective
  db.insert(badgeSurveys).values({
    caregiverId: 1,
    clientId: 1,
    submittedByUserId: 4, // Robert Jr.
    submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    periodMonth: new Date().toISOString().slice(0, 7),
    // Communication
    commClarity: 5,
    commResponsive: 4,
    commProactive: 5,
    // Dependability
    depReliable: 5,
    depFollowThrough: 5,
    // Knowledge
    knwCompetence: 5,
    knwSituational: 4,
    // Connection — this is where Becky shines
    conHappiness: 5,
    conWarmth: 5,
    conPersonhood: 5,
    conAboveAndBeyond: 5,
    conFamilyConfidence: 5,
    notes: "Dad always seems more at ease when Becky is there. She remembers the little things — his music, his stories. We are so grateful.",
  }).run();

  console.log('✅ Badge survey seeded');
}

function seedThoughtsIfEmpty() {
  const existing = db.select().from(thoughtEntries).all();
  if (existing.length > 0) return;

  const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

  const entries = [
    {
      clientId: 1,
      recordedByUserId: 1,
      title: "The summer of '58",
      body: "Robert told me today about a summer he spent working on his uncle's farm in Oklahoma when he was sixteen. Said he learned to drive a tractor before he ever drove a car. He laughed telling it — said the tractor was easier. His uncle paid him two dollars a day and he saved every penny to buy a transistor radio. He still remembers the first song he heard on it. He hummed a few bars but couldn't remember the name.",
      mood: "nostalgic",
      tags: JSON.stringify(["childhood", "family", "work", "memories"]),
      entryType: "text",
      recordedAt: daysAgo(18),
      isUnlocked: false,
    },
    {
      clientId: 1,
      recordedByUserId: 1,
      title: "On getting older",
      body: "He was quiet this morning after breakfast. I asked if he was alright and he said yes, just thinking. After a while he said — 'You know, the hardest part isn't the body slowing down. It's that the world keeps moving and you feel like you're watching it through a window.' I didn't know what to say so I just sat with him for a while. I don't think he needed a response.",
      mood: "reflective",
      tags: JSON.stringify(["aging", "philosophy", "quiet moments"]),
      entryType: "text",
      recordedAt: daysAgo(12),
      isUnlocked: false,
    },
    {
      clientId: 1,
      recordedByUserId: 1,
      title: "Margaret's pie",
      body: "Out of nowhere at lunch today he started talking about his wife Margaret's apple pie. Said she made it every Thanksgiving without fail for forty-two years and that no one has ever made one like it since. He described the cinnamon smell filling the whole house. Said the secret was brown sugar and a little nutmeg, but he suspects she added something else she never told him. He smiled the whole time he was talking about it. I could tell he was there in that kitchen for a few minutes.",
      mood: "joyful",
      tags: JSON.stringify(["Margaret", "family", "Thanksgiving", "food"]),
      entryType: "text",
      recordedAt: daysAgo(8),
      isUnlocked: false,
    },
    {
      clientId: 1,
      recordedByUserId: 1,
      title: "What he's proud of",
      body: "I asked him today what he was most proud of in his life. He thought about it a long time — longer than I expected. Then he said, 'That my kids turned out to be good people. Everything else was just circumstances. But your character — that's a choice.' Then he went back to his crossword like he hadn't just said something that stopped me in my tracks.",
      mood: "reflective",
      tags: JSON.stringify(["family", "values", "wisdom", "Robert Jr.", "Linda"]),
      entryType: "text",
      recordedAt: daysAgo(4),
      isUnlocked: false,
    },
    {
      clientId: 1,
      recordedByUserId: 1,
      title: "The dog story",
      body: "He told me about a dog he had as a boy named Biscuit — a beagle mix that followed him everywhere. Said Biscuit once dragged him out of a drainage ditch during a flash flood when he was eight years old. Pulled him by his belt loop. He says nobody believed him at the time and he's not sure anyone ever will. But he knows what happened. He patted my hand and said, 'Biscuit knew.' I believe him.",
      mood: "humorous",
      tags: JSON.stringify(["childhood", "animals", "Biscuit", "stories"]),
      entryType: "text",
      recordedAt: daysAgo(1),
      isUnlocked: false,
    },
  ];

  for (const entry of entries) {
    db.insert(thoughtEntries).values(entry as any).run();
  }

  console.log('✅ Collection of Thoughts seeded');
}

export const storage: IStorage = {
  // Users
  getUsers: () => db.select().from(users).all(),
  getUserById: (id) => db.select().from(users).where(eq(users.id, id)).get(),
  getUsersByClientId: (clientId) => db.select().from(users).where(eq(users.clientId, clientId)).all(),
  createUser: (data) => db.insert(users).values(data).returning().get(),
  updateUser: (id, data) => db.update(users).set(data).where(eq(users.id, id)).returning().get(),

  // Clients
  getClients: () => db.select().from(clients).all(),
  getClientById: (id) => db.select().from(clients).where(eq(clients.id, id)).get(),
  createClient: (data) => db.insert(clients).values(data).returning().get(),
  updateClient: (id, data) => db.update(clients).set(data).where(eq(clients.id, id)).returning().get(),

  // Schedule Events
  getScheduleEventsByClient: (clientId) => db.select().from(scheduleEvents).where(eq(scheduleEvents.clientId, clientId)).orderBy(asc(scheduleEvents.scheduledAt)).all(),
  getScheduleEventById: (id) => db.select().from(scheduleEvents).where(eq(scheduleEvents.id, id)).get(),
  createScheduleEvent: (data) => db.insert(scheduleEvents).values(data).returning().get(),
  updateScheduleEvent: (id, data) => db.update(scheduleEvents).set(data).where(eq(scheduleEvents.id, id)).returning().get(),
  deleteScheduleEvent: (id) => { db.delete(scheduleEvents).where(eq(scheduleEvents.id, id)).run(); },

  // Activity Logs
  getActivityLogsByClient: (clientId) => db.select().from(activityLogs).where(eq(activityLogs.clientId, clientId)).orderBy(desc(activityLogs.loggedAt)).all(),
  createActivityLog: (data) => db.insert(activityLogs).values(data).returning().get(),
  updateActivityLog: (id, data) => db.update(activityLogs).set(data).where(eq(activityLogs.id, id)).returning().get(),
  deleteActivityLog: (id) => { db.delete(activityLogs).where(eq(activityLogs.id, id)).run(); },
  excuseActivityLog: (id, excuseNote, excusedByUserId) => db.update(activityLogs).set({ isExcused: true, excuseNote, excusedByUserId }).where(eq(activityLogs.id, id)).returning().get(),

  // Chat Threads
  getChatThreadsByClient: (clientId) => db.select().from(chatThreads).where(eq(chatThreads.clientId, clientId)).all(),
  getChatThreadById: (id) => db.select().from(chatThreads).where(eq(chatThreads.id, id)).get(),
  createChatThread: (data) => db.insert(chatThreads).values(data).returning().get(),
  updateChatThread: (id, data) => db.update(chatThreads).set(data).where(eq(chatThreads.id, id)).returning().get(),

  // Messages
  getMessagesByThread: (threadId) => db.select().from(messages).where(eq(messages.threadId, threadId)).orderBy(asc(messages.sentAt)).all(),
  createMessage: (data) => db.insert(messages).values(data).returning().get(),
  markMessageRead: (messageId, userId) => {
    const msg = db.select().from(messages).where(eq(messages.id, messageId)).get();
    if (!msg) return undefined;
    const existing: number[] = JSON.parse(msg.readByUserIds || "[]");
    if (!existing.includes(userId)) existing.push(userId);
    return db.update(messages)
      .set({ isRead: true, readAt: new Date().toISOString(), readByUserIds: JSON.stringify(existing) })
      .where(eq(messages.id, messageId))
      .returning().get();
  },

  // Media
  getMediaByClient: (clientId) => db.select().from(mediaItems).where(eq(mediaItems.clientId, clientId)).orderBy(desc(mediaItems.uploadedAt)).all(),
  createMediaItem: (data) => db.insert(mediaItems).values(data).returning().get(),
  deleteMediaItem: (id) => { db.delete(mediaItems).where(eq(mediaItems.id, id)).run(); },

  // Notifications
  getNotificationsByUser: (userId) => db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).all(),
  createNotification: (data) => db.insert(notifications).values(data).returning().get(),
  markNotificationRead: (id) => { db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).run(); },
  markAllNotificationsRead: (userId) => { db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId)).run(); },

  // Archive
  getArchiveSummariesByClient: (clientId) => db.select().from(archiveSummaries).where(eq(archiveSummaries.clientId, clientId)).orderBy(desc(archiveSummaries.generatedAt)).all(),
  createArchiveSummary: (data) => db.insert(archiveSummaries).values(data).returning().get(),

  // Caregiver profiles
  getCaregiversByClientId: (clientId) => db.select().from(users)
    .where(eq(users.clientId, clientId))
    .all()
    .filter(u => ['caregiver','temp_caregiver','multi_caregiver'].includes(u.role)),

  // Misc Notes
  getMiscNotesByClient: (clientId) => db.select().from(miscNotes).where(eq(miscNotes.clientId, clientId)).orderBy(desc(miscNotes.createdAt)).all(),
  createMiscNote: (data) => db.insert(miscNotes).values(data).returning().get(),
  updateMiscNote: (id, data) => db.update(miscNotes).set(data).where(eq(miscNotes.id, id)).returning().get(),
  deleteMiscNote: (id) => { db.delete(miscNotes).where(eq(miscNotes.id, id)).run(); },

  // Documents
  getDocumentsByClient: (clientId) => db.select().from(documents).where(eq(documents.clientId, clientId)).orderBy(desc(documents.uploadedAt)).all(),
  createDocument: (data) => db.insert(documents).values(data).returning().get(),
  deleteDocument: (id) => { db.delete(documents).where(eq(documents.id, id)).run(); },

  // Outings
  getOutingsByClient: (clientId) => db.select().from(outings).where(eq(outings.clientId, clientId)).orderBy(desc(outings.startedAt)).all(),
  getActiveOutingByClient: (clientId) => db.select().from(outings).where(and(eq(outings.clientId, clientId), eq(outings.status, "active"))).get(),
  createOuting: (data) => db.insert(outings).values(data).returning().get(),
  updateOuting: (id, data) => db.update(outings).set(data).where(eq(outings.id, id)).returning().get(),

  // Shifts
  getShiftsByCaregiver: (caregiverId) => db.select().from(shifts).where(eq(shifts.caregiverId, caregiverId)).orderBy(desc(shifts.clockedInAt)).all(),
  getActiveShift: (caregiverId, clientId) => db.select().from(shifts).where(and(eq(shifts.caregiverId, caregiverId), eq(shifts.clientId, clientId))).all().find(s => !s.clockedOutAt),
  clockIn: (caregiverId, clientId) => db.insert(shifts).values({ caregiverId, clientId, clockedInAt: new Date().toISOString() }).returning().get(),
  clockOut: (shiftId) => db.update(shifts).set({ clockedOutAt: new Date().toISOString() }).where(eq(shifts.id, shiftId)).returning().get(),

  // Care Flags
  getCareFlagsByClient: (clientId) => db.select().from(careFlags).where(eq(careFlags.clientId, clientId)).orderBy(desc(careFlags.triggeredAt)).all(),
  getCareFlagsByCaregiver: (caregiverId, clientId) => db.select().from(careFlags).where(and(eq(careFlags.caregiverId, caregiverId), eq(careFlags.clientId, clientId))).orderBy(desc(careFlags.triggeredAt)).all(),
  createCareFlag: (data) => db.insert(careFlags).values(data).returning().get(),
  excuseCareFlag: (id, excuseNote, excusedByUserId) => db.update(careFlags).set({ isExcused: true, excuseNote, excusedByUserId, excusedAt: new Date().toISOString() }).where(eq(careFlags.id, id)).returning().get(),
  getUnexcusedFlagCount: (caregiverId, clientId, category, since) => {
    const flags = db.select().from(careFlags).where(
      and(eq(careFlags.caregiverId, caregiverId), eq(careFlags.clientId, clientId), eq(careFlags.category, category), eq(careFlags.isExcused, false))
    ).all();
    return flags.filter(f => f.triggeredAt >= since && f.flagType === 'yellow').length;
  },
  getRatingScore: (caregiverId, clientId) => {
    // Rolling 30-day window
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const allFlags = db.select().from(careFlags).where(
      and(eq(careFlags.caregiverId, caregiverId), eq(careFlags.clientId, clientId))
    ).all().filter(f => f.triggeredAt >= since);
    const activeFlags = allFlags.filter(f => !f.isExcused);
    // Each unexcused yellow = -3 points, each red = -8 points, base = 100
    const deductions = activeFlags.reduce((sum, f) => sum + (f.flagType === 'red' ? 8 : 3), 0);
    return Math.max(0, 100 - deductions);
  },

  // Vitals
  getVitalsByClient: (clientId, limit = 50) =>
    db.select().from(vitals).where(eq(vitals.clientId, clientId))
      .orderBy(desc(vitals.recordedAt)).limit(limit).all(),
  getLatestVitals: (clientId) =>
    db.select().from(vitals).where(eq(vitals.clientId, clientId))
      .orderBy(desc(vitals.recordedAt)).limit(1).all()[0],
  createVitals: (data) => db.insert(vitals).values(data).returning().get(),

  // Medications
  getMedicationsByClient: (clientId, status) => {
    const q = db.select().from(medications).where(eq(medications.clientId, clientId));
    const all = q.orderBy(asc(medications.name)).all();
    return status ? all.filter(m => m.status === status) : all;
  },
  getMedicationById: (id) =>
    db.select().from(medications).where(eq(medications.id, id)).get(),
  createMedication: (data) => db.insert(medications).values(data).returning().get(),
  updateMedication: (id, data, changedByUserId, changeNote) => {
    const existing = db.select().from(medications).where(eq(medications.id, id)).get();
    if (!existing) return undefined;
    // Log each changed field to history
    const now = new Date().toISOString();
    for (const [field, newVal] of Object.entries(data)) {
      const oldVal = (existing as any)[field];
      if (oldVal !== newVal) {
        db.insert(medicationHistory).values({
          medicationId: id,
          changedAt: now,
          changedByUserId,
          fieldChanged: field,
          oldValue: oldVal != null ? String(oldVal) : undefined,
          newValue: newVal != null ? String(newVal) : undefined,
          note: changeNote,
        }).run();
      }
    }
    return db.update(medications).set({ ...data, updatedAt: now }).where(eq(medications.id, id)).returning().get();
  },
  discontinueMedication: (id, reason, note, date, changedByUserId) => {
    const now = new Date().toISOString();
    db.insert(medicationHistory).values({
      medicationId: id,
      changedAt: now,
      changedByUserId,
      fieldChanged: 'status',
      oldValue: 'active',
      newValue: 'discontinued',
      note,
    }).run();
    return db.update(medications).set({
      status: 'discontinued',
      discontinuedDate: date,
      discontinuedReason: reason,
      discontinuedNote: note,
      updatedAt: now,
    }).where(eq(medications.id, id)).returning().get();
  },
  getMedicationHistory: (medicationId) =>
    db.select().from(medicationHistory).where(eq(medicationHistory.medicationId, medicationId))
      .orderBy(desc(medicationHistory.changedAt)).all(),
  getMedicationLogs: (clientId, limit = 100) =>
    db.select().from(medicationLogs).where(eq(medicationLogs.clientId, clientId))
      .orderBy(desc(medicationLogs.loggedAt)).limit(limit).all(),
  getMedicationLogsByMed: (medicationId, limit = 50) =>
    db.select().from(medicationLogs).where(eq(medicationLogs.medicationId, medicationId))
      .orderBy(desc(medicationLogs.loggedAt)).limit(limit).all(),
  createMedicationLog: (data) => db.insert(medicationLogs).values(data).returning().get(),

  // A Collection of Thoughts
  getThoughtsByClient: (clientId: number) =>
    db.select().from(thoughtEntries).where(eq(thoughtEntries.clientId, clientId))
      .orderBy(desc(thoughtEntries.recordedAt)).all(),
  getThoughtById: (id: number) =>
    db.select().from(thoughtEntries).where(eq(thoughtEntries.id, id)).get(),
  createThought: (data: InsertThoughtEntry) =>
    db.insert(thoughtEntries).values(data).returning().get(),
  updateThought: (id: number, data: Partial<InsertThoughtEntry>) =>
    db.update(thoughtEntries).set({ ...data, editedAt: new Date().toISOString() }).where(eq(thoughtEntries.id, id)).returning().get(),
  deleteThought: (id: number) => { db.delete(thoughtEntries).where(eq(thoughtEntries.id, id)).run(); },
  unlockAllThoughts: (clientId: number, unlockedByUserId: number, unlockNote?: string) => {
    const now = new Date().toISOString();
    db.update(thoughtEntries)
      .set({ isUnlocked: true, unlockedAt: now, unlockedByUserId, unlockNote: unlockNote || null })
      .where(eq(thoughtEntries.clientId, clientId)).run();
  },
  isCollectionUnlocked: (clientId: number) => {
    const any = db.select().from(thoughtEntries).where(and(eq(thoughtEntries.clientId, clientId), eq(thoughtEntries.isUnlocked, true))).all();
    return any.length > 0;
  },

  // Caregiver Profiles
  getCaregiverProfile: (userId: number) =>
    db.select().from(caregiverProfiles).where(eq(caregiverProfiles.userId, userId)).get(),
  upsertCaregiverProfile: (userId: number, data: Partial<InsertCaregiverProfile>) => {
    const existing = db.select().from(caregiverProfiles).where(eq(caregiverProfiles.userId, userId)).get();
    if (existing) {
      return db.update(caregiverProfiles)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(caregiverProfiles.userId, userId))
        .returning().get();
    } else {
      return db.insert(caregiverProfiles)
        .values({ userId, createdAt: new Date().toISOString(), ...data } as InsertCaregiverProfile)
        .returning().get();
    }
  },
  getPublicCaregiverProfiles: () =>
    db.select().from(caregiverProfiles).where(eq(caregiverProfiles.isPublic, true)).all(),

  // Care Scope
  getCareScope: (clientId: number, caregiverId: number) =>
    db.select().from(careScopes)
      .where(and(eq(careScopes.clientId, clientId), eq(careScopes.caregiverId, caregiverId)))
      .get(),

  upsertCareScope: (clientId: number, caregiverId: number, data: Partial<InsertCareScope>, updatedByUserId: number): CareScope => {
    const existing = db.select().from(careScopes)
      .where(and(eq(careScopes.clientId, clientId), eq(careScopes.caregiverId, caregiverId)))
      .get();
    const now = new Date().toISOString();
    if (existing) {
      return db.update(careScopes)
        .set({ ...data, updatedAt: now, updatedByUserId })
        .where(and(eq(careScopes.clientId, clientId), eq(careScopes.caregiverId, caregiverId)))
        .returning().get()!;
    } else {
      return db.insert(careScopes).values({
        clientId,
        caregiverId,
        medications: true,
        vitals: true,
        appointments: true,
        activityLog: true,
        messaging: true,
        ...data,
        updatedAt: now,
        updatedByUserId,
      } as InsertCareScope).returning().get()!;
    }
  },

  getDefaultScope: () => ({
    medications: true,
    vitals: true,
    appointments: true,
    activityLog: true,
    messaging: true,
    medicationsNote: null,
    vitalsNote: null,
    appointmentsNote: null,
    pendingRequest: null,
  }),

  // ── Flag Control ──────────────────────────────────────────────

  getFlagControl: (clientId: number, caregiverId: number) =>
    db.select().from(flagControls)
      .where(and(eq(flagControls.clientId, clientId), eq(flagControls.caregiverId, caregiverId)))
      .get(),

  upsertFlagControl: (clientId: number, caregiverId: number, data: Partial<InsertFlagControl>, updatedByUserId: number): FlagControl => {
    const existing = db.select().from(flagControls)
      .where(and(eq(flagControls.clientId, clientId), eq(flagControls.caregiverId, caregiverId)))
      .get();
    const now = new Date().toISOString();
    if (existing) {
      return db.update(flagControls)
        .set({ ...data, updatedAt: now, updatedByUserId })
        .where(and(eq(flagControls.clientId, clientId), eq(flagControls.caregiverId, caregiverId)))
        .returning().get()!;
    } else {
      return db.insert(flagControls).values({
        clientId,
        caregiverId,
        medicationFlags: true,
        appointmentFlags: true,
        messageFlags: true,
        ...data,
        updatedAt: now,
        updatedByUserId,
      } as InsertFlagControl).returning().get()!;
    }
  },

  getDefaultFlagControl: () => ({
    medicationFlags: true,
    appointmentFlags: true,
    messageFlags: true,
    medicationFlagsNote: null,
    appointmentFlagsNote: null,
    messageFlagsNote: null,
  }),

  // ── Wellbeing ─────────────────────────────────────────────────────────────

  createWellbeingCheckIn: (data: InsertWellbeingCheckIn): WellbeingCheckIn =>
    db.insert(wellbeingCheckIns).values(data).returning().get()!,

  getWellbeingCheckIns: (userId: number, limit = 30): WellbeingCheckIn[] =>
    db.select().from(wellbeingCheckIns)
      .where(eq(wellbeingCheckIns.userId, userId))
      .orderBy(desc(wellbeingCheckIns.createdAt))
      .limit(limit)
      .all(),

  getWellbeingStreak: (userId: number): WellbeingStreak | undefined =>
    db.select().from(wellbeingStreaks).where(eq(wellbeingStreaks.userId, userId)).get(),

  upsertWellbeingStreak: (userId: number): WellbeingStreak => {
    const today = new Date().toISOString().slice(0, 10);
    const existing = db.select().from(wellbeingStreaks).where(eq(wellbeingStreaks.userId, userId)).get();
    if (!existing) {
      return db.insert(wellbeingStreaks).values({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        totalCheckIns: 1,
        lastCheckInDate: today,
        earnedBadges: JSON.stringify(["first_checkin"]),
      }).returning().get()!;
    }
    // Already checked in today — no streak change
    if (existing.lastCheckInDate === today) return existing;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newStreak = existing.lastCheckInDate === yesterday ? (existing.currentStreak || 0) + 1 : 1;
    const longest = Math.max(newStreak, existing.longestStreak || 0);
    const total = (existing.totalCheckIns || 0) + 1;
    const badges: string[] = JSON.parse(existing.earnedBadges || "[]");
    if (!badges.includes("first_checkin")) badges.push("first_checkin");
    if (newStreak >= 7 && !badges.includes("week_streak")) badges.push("week_streak");
    if (newStreak >= 30 && !badges.includes("month_streak")) badges.push("month_streak");
    if (total >= 10 && !badges.includes("ten_checkins")) badges.push("ten_checkins");
    return db.update(wellbeingStreaks)
      .set({ currentStreak: newStreak, longestStreak: longest, totalCheckIns: total, lastCheckInDate: today, earnedBadges: JSON.stringify(badges) })
      .where(eq(wellbeingStreaks.userId, userId))
      .returning().get()!;
  },

  getRecentUrgentFlagCount: (userId: number, clientId: number, hoursBack = 72): number => {
    const since = new Date(Date.now() - hoursBack * 3600000).toISOString();
    const logs = db.select().from(activityLogs)
      .where(and(eq(activityLogs.clientId, clientId), eq(activityLogs.loggedByUserId, userId)))
      .all();
    return logs.filter(l => l.priority === "red" && l.loggedAt > since).length;
  },

  // University
  completeLesson: (userId: number, lessonId: string, trackId: string, knowledgePoints: number): UniversityProgress => {
    // Idempotent — if already completed, return existing
    const existing = db.select().from(universityProgress)
      .where(and(eq(universityProgress.userId, userId), eq(universityProgress.lessonId, lessonId)))
      .get();
    if (existing) return existing;
    return db.insert(universityProgress).values({
      userId,
      lessonId,
      trackId,
      knowledgePoints,
      completedAt: new Date().toISOString(),
    }).returning().get()!;
  },

  getCompletedLessons: (userId: number): UniversityProgress[] =>
    db.select().from(universityProgress)
      .where(eq(universityProgress.userId, userId))
      .orderBy(desc(universityProgress.completedAt))
      .all(),

  getTotalKnowledgePoints: (userId: number): number => {
    const rows = db.select().from(universityProgress)
      .where(eq(universityProgress.userId, userId))
      .all();
    return rows.reduce((sum, r) => sum + (r.knowledgePoints || 0), 0);
  },

  // Becky Response Library
  getBeckyResponses: (theme?: string): BeckyResponse[] => {
    if (theme) {
      return db.select().from(beckyResponses)
        .where(eq(beckyResponses.theme, theme))
        .orderBy(beckyResponses.theme, beckyResponses.id)
        .all();
    }
    return db.select().from(beckyResponses)
      .orderBy(beckyResponses.theme, beckyResponses.id)
      .all();
  },

  getBeckyResponseById: (id: number): BeckyResponse | undefined =>
    db.select().from(beckyResponses).where(eq(beckyResponses.id, id)).get(),

  createBeckyResponse: (data: InsertBeckyResponse): BeckyResponse =>
    db.insert(beckyResponses).values(data).returning().get()!,

  updateBeckyResponse: (id: number, data: Partial<InsertBeckyResponse>): BeckyResponse | undefined => {
    const now = new Date().toISOString();
    return db.update(beckyResponses)
      .set({ ...data, updatedAt: now })
      .where(eq(beckyResponses.id, id))
      .returning().get();
  },

  deleteBeckyResponse: (id: number): void => {
    db.delete(beckyResponses).where(eq(beckyResponses.id, id)).run();
  },

  getResponsesForTheme: (theme: string): BeckyResponse[] =>
    db.select().from(beckyResponses)
      .where(and(eq(beckyResponses.theme, theme), eq(beckyResponses.isActive, 1)))
      .all(),

  seedBeckyResponsesIfEmpty: (): void => {
    const existing = db.select().from(beckyResponses).all();
    if (existing.length > 0) return;
    const now = new Date().toISOString();
    const seeds = [
      // burnout
      { theme: "burnout", examplePrompt: "I am so exhausted. I don't know how much longer I can keep going like this.", response: "I hear you. And I want you to know — that tired feeling you're carrying is real. It is not weakness. It is the evidence of how much you have poured into someone else's life. I've been in that same place where I didn't even know what I needed, I just knew I was done. You don't have to fix that tonight. But I do want you to let yourself rest without guilt. What you feel right now makes complete sense.", isPlaceholder: 1 },
      { theme: "burnout", examplePrompt: "I drove home in silence today. I had nothing left.", response: "That kind of tired goes so much deeper than sleep, doesn't it? I remember days where I drove home in silence because I had nothing left — not even music. And I still had to walk into my own house and be a person. That is a specific kind of hard that most people never understand. But I do. And I'm proud of you for still showing up. Take whatever rest you can get tonight. You've earned it.", isPlaceholder: 1 },
      { theme: "burnout", examplePrompt: "I feel worn down and invisible. Nobody sees how hard I work.", response: "Can I just say something? The fact that you're checking in right now, when you're this worn down, says everything about who you are. You could have just gone home and crashed. But you took a second to acknowledge yourself. That matters. You matter. I'm not going to tell you to take a bubble bath. I'm going to tell you that what you do is hard, it is real, and you are not invisible to me.", isPlaceholder: 1 },
      // family_stress
      { theme: "family_stress", examplePrompt: "I'm dealing with something hard at home and I can't stop thinking about it at work.", response: "I know what it's like to walk through that door carrying something from home that you never asked to bring to work. You set it down at the door. You give your whole self to someone else's loved one. And then you pick that weight back up on the way out. That is one of the most invisible sacrifices a caregiver makes — and nobody talks about it. I see you. Both of your worlds are real, and both of them deserve to be acknowledged.", isPlaceholder: 1 },
      { theme: "family_stress", examplePrompt: "I showed up today even though my own family is going through something. I feel guilty.", response: "You are holding so much right now. And the fact that you showed up anyway — that's not small. That is the kind of commitment that doesn't come with a title or a raise. It comes from character. But I also want you to know: you are allowed to not be okay. You don't have to perform strength right now. Not here. Not with me.", isPlaceholder: 1 },
      // difficult_family
      { theme: "difficult_family", examplePrompt: "A family member keeps criticizing everything I do. I'm starting to take it personally.", response: "Here is something I had to learn the hard way: when a family member comes at you sideways, it is almost never actually about you. It is fear. It is grief. It is the helplessness of watching someone they love decline, and you are the closest person to aim that at. That doesn't make it okay. But it might help it hurt a little less. You are not doing anything wrong. You are just the safe person in an unsafe situation.", isPlaceholder: 1 },
      { theme: "difficult_family", examplePrompt: "The family makes me feel like nothing I do is ever good enough.", response: "That is such a hard spot to be in — where you're trying to do your best and someone is making you feel like your best isn't enough. I've been there. And I had to remind myself that I was hired because I'm qualified, I show up, and I genuinely care. Nobody gets to take that from me. Nobody gets to take it from you either.", isPlaceholder: 1 },
      { theme: "difficult_family", examplePrompt: "I have to stay calm for everyone but inside I'm really struggling with the tension.", response: "Sometimes the most professional thing you can do is feel hurt in private and then keep going. That's not suppression — that's strength. But please don't stay in the private part alone. Bring it here. Bring it to someone who gets it. The burden of being the calm one in a room full of scared people is real, and you deserve a place to put it down.", isPlaceholder: 1 },
      // client_decline
      { theme: "client_decline", examplePrompt: "We received some very bad news about my client today. I need to be strong but it is hitting me hard as well.", response: "You were in that room. You saw those faces. And you kept yourself steady even while you were quietly breaking inside. That is one of the most profound things a caregiver does — holding space for someone else's pain while carrying your own. That does not go unnoticed. Not by me. I've been in that kitchen making coffee, handing out tissues, and trying not to let them see my eyes. I know exactly what you're carrying right now.", isPlaceholder: 1 },
      { theme: "client_decline", examplePrompt: "I'm watching my client decline and it's hard not to get attached. I feel like I'm grieving already.", response: "The hard truth about this work is that you are going to love people you are going to lose. And that love is not unprofessional. It is what makes you good at what you do. What you felt today — that hurt — it means you did it right. You were present. You were real. Give yourself permission to grieve too.", isPlaceholder: 1 },
      // personal_crisis
      { theme: "personal_crisis", examplePrompt: "I have a family member who is sick and I'm trying to care for my client at the same time. I'm being pulled in every direction.", response: "I cannot imagine how that feels — being so focused on caring for someone else's family while your own is going through something that needs you too. That is one of the deepest tests a caregiver faces. And there is no clean answer for it. I just want you to know: you are allowed to feel the weight of that. You are not less of a professional for also being a human being with people you love.", isPlaceholder: 1 },
      { theme: "personal_crisis", examplePrompt: "My mind keeps drifting to my own problems while I'm with my client. I feel guilty.", response: "I have had moments where I was sitting with a client and my mind was somewhere else completely — with my own family, my own fear. And I felt guilty for every second of it. But I kept showing up. Just like you are. I want you to give yourself the same compassion you give everyone else. You deserve care too.", isPlaceholder: 1 },
      // lonely
      { theme: "lonely", examplePrompt: "I feel like nobody really understands what I go through. I feel so alone in this.", response: "You know what I think sometimes? That the loneliest people in a caregiving situation are often the caregivers. You are surrounded by people, and yet you are quietly invisible. The family sees the tasks. The client needs the care. And you just keep going. I want you to know that I see the whole of what you do — not just the tasks, but the emotional labor. The heart behind it. That matters, and you matter.", isPlaceholder: 1 },
      { theme: "lonely", examplePrompt: "I just needed someone to talk to. I don't have anyone who really gets it.", response: "Reaching out when you feel alone takes courage. I'm really glad you did. Sometimes all we need is for someone to say — I hear you, I'm here, and you are not as alone as it feels right now. So here I am saying it: I'm here. And I mean it.", isPlaceholder: 1 },
      // unappreciated
      { theme: "unappreciated", examplePrompt: "I work so hard and nobody ever says thank you. I'm starting to wonder why I do this.", response: "This one stings in a specific way, doesn't it? Because you pour yourself into this work, and sometimes the response is silence. Or worse, criticism. I want you to hear me: your value is not determined by whether someone said thank you today. The care you gave was real. The difference you made was real. Some days the best we get is knowing in our own heart that we showed up fully. And you did.", isPlaceholder: 1 },
      { theme: "unappreciated", examplePrompt: "I feel taken for granted. Like I'm just furniture in this house.", response: "Gratitude in this field is inconsistent. I learned that. But I also learned that my reasons for doing this work had to come from inside me, not from waiting for someone to notice. That doesn't mean it doesn't hurt when they don't. It does. Feel that. And then remember why you started. What made you choose this work in the first place?", isPlaceholder: 1 },
      // general
      { theme: "general", examplePrompt: "I just needed to reach out. I'm not sure what I need exactly, I just needed someone to hear me.", response: "Thank you for trusting me enough to reach out. Really. I know it can feel strange — typing your heart out into a screen. But I want you to know that whoever you are and whatever you're carrying today, you are not doing this alone. You are part of a community of people who chose one of the hardest callings there is. And that matters. You matter. I'm here.", isPlaceholder: 1 },
      { theme: "general", examplePrompt: "Today was just hard. I can't even explain why.", response: "I'm glad you checked in. Not every hard moment needs a fix — sometimes you just need someone to say: I hear you, I see you, and what you do has meaning. All three of those things are true right now. You are seen. And I'm proud of you for pausing long enough to take care of yourself for once.", isPlaceholder: 1 },
      { theme: "general", examplePrompt: "Some days this work is beautiful and some days it's just heavy. Today is heavy.", response: "Some days this work is genuinely beautiful. And some days it is genuinely heavy. Today sounds like a heavy one. I just want to sit with you in that for a second before anything else. You don't have to fix it right now. You don't have to explain it. You just needed a place to put it. This is that place. And I'm not going anywhere.", isPlaceholder: 1 },
    ];
    for (const s of seeds) {
      db.insert(beckyResponses).values({ ...s, isActive: 1, createdAt: now, updatedAt: now }).run();
    }
  },
};

storage.seedBeckyResponsesIfEmpty();
