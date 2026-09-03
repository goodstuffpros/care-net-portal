import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  users, clients, scheduleEvents, activityLogs, activityLogAddendums, chatThreads,
  messages, mediaItems, notifications, archiveSummaries, miscNotes,
  documents, outings, shifts, careFlags, vitals,
  medications, medicationHistory, medicationLogs,
  badgeSurveys, badgeScores,
  thoughtEntries, caregiverProfiles, careScopes, flagControls,
  type ActivityLogAddendum,
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
  documentAccessLog,
  type DocumentAccessLog, type InsertDocumentAccessLog,
  emergencyAlerts,
  type EmergencyAlert, type InsertEmergencyAlert,
  ideas,
  type Idea, type InsertIdea,
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
    reminder_minutes INTEGER DEFAULT 30,
    alarm_enabled INTEGER DEFAULT 0,
    alarm_lead_minutes INTEGER DEFAULT 15
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
  CREATE TABLE IF NOT EXISTS activity_log_addendums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_log_id INTEGER NOT NULL,
    author_user_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    note TEXT NOT NULL,
    struck_text TEXT,
    corrected_text TEXT,
    initials TEXT,
    created_at TEXT NOT NULL
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
    is_confidential INTEGER DEFAULT 0,
    cg_access TEXT DEFAULT 'none'
  );
  CREATE TABLE IF NOT EXISTS document_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    accessed_at TEXT NOT NULL
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

// ── Safe migrations — run BEFORE any Drizzle queries ────────────────────────
// These must all be here, at the top, before storage methods are called.

// users — columns added over time
try { sqlite.exec(`ALTER TABLE users ADD COLUMN onboarding_completed_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN mc_setup_completed_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN care_path_choice TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN seen_modules TEXT DEFAULT '[]'`); } catch {}
// One-time HIW reset removed — seen_modules wipe no longer needed (HIW overlays removed 2026-05-09)
try { sqlite.exec(`ALTER TABLE users ADD COLUMN nav_order TEXT DEFAULT '[]'`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN timezone TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN notification_prefs TEXT DEFAULT '{"all":true}'`); } catch {}
try { sqlite.exec(`ALTER TABLE documents ADD COLUMN cg_access TEXT DEFAULT 'none'`); } catch {}
try { sqlite.exec(`CREATE TABLE IF NOT EXISTS document_access_log (id INTEGER PRIMARY KEY AUTOINCREMENT, doc_id INTEGER NOT NULL, user_id INTEGER NOT NULL, action TEXT NOT NULL, accessed_at TEXT NOT NULL)`); } catch {}

// schedule_events — columns added after initial release
try { sqlite.exec(`ALTER TABLE schedule_events ADD COLUMN alarm_enabled INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE schedule_events ADD COLUMN alarm_lead_minutes INTEGER DEFAULT 15`); } catch {}
try { sqlite.exec(`ALTER TABLE schedule_events ADD COLUMN caregiver_responsible INTEGER DEFAULT 1`); } catch {}
try { sqlite.exec(`ALTER TABLE schedule_events ADD COLUMN responsibility_note TEXT`); } catch {}

// activity_logs — columns added after initial release
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN logged_by_role TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN is_off_shift_entry INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN is_emergency INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN emergency_type TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN notes TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN is_late_entry INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN is_excused INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN excuse_note TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN excused_by_user_id INTEGER`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN scheduled_at TEXT`); } catch {}

// caregiver_profiles — columns added after initial release
try { sqlite.exec(`ALTER TABLE caregiver_profiles ADD COLUMN travel_distance TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE caregiver_profiles ADD COLUMN custom_specialties TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE caregiver_profiles ADD COLUMN custom_certifications TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE caregiver_profiles ADD COLUMN photo_url TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE caregiver_profiles ADD COLUMN display_name TEXT`); } catch {}

// clients — extended medical profile fields
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN diagnoses TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN assistive_devices TEXT`); } catch {}
// clients — additional medical snapshot fields (blood type, height, weight)
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN blood_type TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN height TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN weight_lbs REAL`); } catch {}
// care_directory_entries — emergency contact flag
try { sqlite.exec(`ALTER TABLE care_directory_entries ADD COLUMN is_emergency INTEGER DEFAULT 0`); } catch {}
// clients — sample portal columns
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN is_practice INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN is_showcase INTEGER DEFAULT 0`); } catch {}
// users — sample client permanent anchor
try { sqlite.exec(`ALTER TABLE users ADD COLUMN sample_client_id INTEGER`); } catch {}
// users — client empowerment permission level
try { sqlite.exec(`ALTER TABLE users ADD COLUMN permission_level TEXT`); } catch {}
// clients — client empowerment: who is the client account + ownership transfer tracking
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN client_user_id INTEGER`); } catch {}
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN ownership_transfer_initiated_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN ownership_transfer_confirmed_at TEXT`); } catch {}
// Phase 2 — Contributor mode
try { sqlite.exec(`ALTER TABLE users ADD COLUMN contributor_welcome_seen INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN requires_minor_approval INTEGER DEFAULT 0`); } catch {}
// Phase 3 — Transfer of Care
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN transfer_initiated_by TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN transfer_step INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN transfer_mc_co_confirmed INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN transfer_offered_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN transfer_step2_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN transfer_cancelled_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN mc_post_transfer_role TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN pending_review INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN approved_by_user_id INTEGER`); } catch {}
try { sqlite.exec(`ALTER TABLE activity_logs ADD COLUMN health_history_entry_id INTEGER`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN font_size_preference TEXT DEFAULT 'normal'`); } catch {}
try { sqlite.exec(`ALTER TABLE vitals ADD COLUMN pending_review INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE vitals ADD COLUMN approved_by_user_id INTEGER`); } catch {}
try { sqlite.exec(`ALTER TABLE vitals ADD COLUMN recorded_by_user_id INTEGER`); } catch {}

// shifts — CREATE TABLE IF NOT EXISTS (may not exist on older DBs)
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caregiver_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    clocked_in_at TEXT NOT NULL,
    clocked_out_at TEXT,
    notes TEXT
  )`);
} catch {}

// care_flags — CREATE TABLE IF NOT EXISTS
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS care_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    caregiver_id INTEGER NOT NULL,
    flag_type TEXT NOT NULL,
    category TEXT NOT NULL,
    reason TEXT NOT NULL,
    reference_id INTEGER,
    reference_type TEXT,
    triggered_at TEXT NOT NULL,
    is_excused INTEGER DEFAULT 0,
    excuse_note TEXT,
    excused_by_user_id INTEGER,
    excused_at TEXT
  )`);
} catch {}

// observation_tags — CREATE TABLE IF NOT EXISTS
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS observation_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    source_type TEXT NOT NULL,
    source_id INTEGER NOT NULL,
    observed_at TEXT NOT NULL,
    category TEXT NOT NULL,
    tag TEXT NOT NULL,
    severity TEXT,
    raw_text TEXT,
    created_at TEXT NOT NULL
  )`);
} catch {}

// health_patterns — CREATE TABLE IF NOT EXISTS
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS health_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    pattern_key TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    symptom_tag TEXT,
    correlated_with TEXT,
    severity TEXT NOT NULL DEFAULT 'low',
    occurrence_count INTEGER NOT NULL DEFAULT 0,
    consecutive_days INTEGER NOT NULL DEFAULT 0,
    window_days INTEGER NOT NULL DEFAULT 7,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    alert_3day_fired_at TEXT,
    alert_7day_fired_at TEXT,
    alert_3x_week_fired_at TEXT,
    alert_6x_2week_fired_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    dismissed_at TEXT,
    dismissed_by_user_id INTEGER,
    dismissed_until TEXT,
    resolved_at TEXT,
    escalated_at TEXT,
    escalated_by_user_id INTEGER,
    doctor_note_text TEXT,
    doctor_note_sent_at TEXT,
    doctor_note_sent_by_user_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
} catch {}

// pattern_acknowledgements — CREATE TABLE IF NOT EXISTS
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS pattern_acknowledgements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    alert_level TEXT NOT NULL,
    acknowledged_at TEXT NOT NULL
  )`);
} catch {}

// pattern_preferences — CREATE TABLE IF NOT EXISTS
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS pattern_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    watch_symptoms INTEGER DEFAULT 1,
    watch_activity INTEGER DEFAULT 1,
    watch_food INTEGER DEFAULT 1,
    watch_sleep INTEGER DEFAULT 1,
    watch_vitals INTEGER DEFAULT 1,
    notify_threshold TEXT DEFAULT 'medium',
    updated_at TEXT NOT NULL
  )`);
} catch {}
// Help desk escalations table
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS helpdesk_escalations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_name TEXT,
    user_role TEXT,
    current_page TEXT,
    conversation TEXT NOT NULL,
    resolved INTEGER DEFAULT 0,
    resolution TEXT,
    created_at TEXT NOT NULL
  )`);
} catch { /* table already exists */ }
// Safe migration: schedule_events alarm columns
try { sqlite.exec(`ALTER TABLE schedule_events ADD COLUMN alarm_enabled INTEGER DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE schedule_events ADD COLUMN alarm_lead_minutes INTEGER DEFAULT 15`); } catch {}
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
  getPracticeClientByCaregiverId(caregiverId: number): Client | undefined;
  createPracticeClient(caregiverId: number, dateOfBirth: string, primaryCondition: string): Client;
  deletePracticeClient(clientId: number): void;
  setShowcase(clientId: number, isShowcase: boolean): Client | undefined;
  createSelfCareClient(userId: number, clientName: string, dateOfBirth: string | null, primaryCondition: string | null): Client;

  // Client Empowerment
  linkClientUser(clientId: number, userId: number): Client | undefined;
  unlinkClientUser(clientId: number): Client | undefined;
  setClientPermissionLevel(userId: number, level: 'observer' | 'contributor' | 'self_care_mc'): User | undefined;
  getClientByClientUserId(userId: number): Client | undefined;

  // Phase 3 — Transfer of Care
  initiateTransfer(clientId: number, initiatedBy: 'mc' | 'client'): Client | undefined;
  advanceTransferStep(clientId: number, step: number): Client | undefined;
  mcCoConfirmTransfer(clientId: number): Client | undefined;
  cancelTransfer(clientId: number): Client | undefined;
  executeTransfer(clientId: number, mcPostTransferRole: 'monitor' | 'step_back' | 'remove'): { client: Client; oldMcUser: User | undefined; clientUser: User | undefined } | undefined;
  getTransferStatus(clientId: number): { step: number; initiatedBy: string | null; offeredAt: string | null; step2At: string | null; mcCoConfirmed: boolean; cancelledAt: string | null; confirmedAt: string | null } | undefined;

  // Schedule Events
  getScheduleEventsByClient(clientId: number): ScheduleEvent[];
  getScheduleEventById(id: number): ScheduleEvent | undefined;
  createScheduleEvent(data: InsertScheduleEvent): ScheduleEvent;
  updateScheduleEvent(id: number, data: Partial<InsertScheduleEvent>): ScheduleEvent | undefined;
  deleteScheduleEvent(id: number): void;

  // Activity Logs
  getActivityLogsByClient(clientId: number): ActivityLog[];
  getActivityLogById(id: number): ActivityLog | undefined;
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
  getMessageById(id: number): Message | undefined;
  createMessage(data: InsertMessage): Message;
  markMessageRead(messageId: number, userId: number): Message | undefined;

  // Media
  getMediaByClient(clientId: number): MediaItem[];
  getMediaItemById(id: number): MediaItem | undefined;
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
  getMiscNoteById(id: number): MiscNote | undefined;
  createMiscNote(data: InsertMiscNote): MiscNote;
  updateMiscNote(id: number, data: Partial<InsertMiscNote>): MiscNote | undefined;
  deleteMiscNote(id: number): void;

  // Documents
  getDocumentsByClient(clientId: number): Document[];
  getDocumentById(id: number): Document | undefined;
  createDocument(data: InsertDocument): Document;
  deleteDocument(id: number): void;
  updateDocumentAccess(id: number, cgAccess: string): Document | undefined;
  logDocumentAccess(docId: number, userId: number, action: string): DocumentAccessLog;
  getDocumentAccessLog(docId: number): DocumentAccessLog[];

  // Outings
  getOutingsByClient(clientId: number): Outing[];
  getOutingById(id: number): Outing | undefined;
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
  getVitalById(id: number): Vitals | undefined;
  createVitals(data: InsertVitals): Vitals;
  updateVital(id: number, data: Partial<InsertVitals>): Vitals | undefined;

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

  // Emergency Alerts
  createEmergencyAlert(data: InsertEmergencyAlert): EmergencyAlert;
  getEmergencyAlertsByClient(clientId: number): EmergencyAlert[];
  markReminderSent(alertId: number): void;

  // Ideas
  createIdea(data: InsertIdea): Idea;
  getAllIdeas(): Idea[];
  getIdeasByCluster(): { clusterId: string; clusterLabel: string; count: number; ideas: Idea[] }[];
  updateIdea(id: number, data: Partial<Idea>): Idea | undefined;
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
  getPracticeClientByCaregiverId: (caregiverId) =>
    db.select().from(clients)
      .where(and(eq(clients.caregiverId, caregiverId), eq(clients.isPractice, true)))
      .get(),
  createPracticeClient: (caregiverId, dateOfBirth, primaryCondition) => {
    const client = db.insert(clients).values({
      name: "Sample Client",
      caregiverId,
      dateOfBirth,
      primaryCondition,
      isPractice: true,
      isShowcase: false,
      isActive: true,
      appMode: "caregiver",
    }).returning().get();
    // Store permanent anchor on user — never cleared when real client connects
    db.update(users).set({ sampleClientId: client.id }).where(eq(users.id, caregiverId)).run();
    return client;
  },
  deletePracticeClient: (clientId) => {
    // Also clear sampleClientId on the owning CG
    const client = db.select().from(clients).where(eq(clients.id, clientId)).get();
    if (client?.caregiverId) {
      db.update(users).set({ sampleClientId: null }).where(eq(users.id, client.caregiverId)).run();
    }
    db.delete(clients).where(eq(clients.id, clientId)).run();
  },
  setShowcase: (clientId, isShowcase) =>
    db.update(clients).set({ isShowcase }).where(eq(clients.id, clientId)).returning().get(),

  // Self-Managed Care — create a real client record owned by the self-care user themselves
  createSelfCareClient: (userId, clientName, dateOfBirth, primaryCondition) => {
    const client = db.insert(clients).values({
      name: clientName,
      caregiverId: userId,
      primaryContactId: userId,
      dateOfBirth: dateOfBirth || null,
      primaryCondition: primaryCondition || null,
      isPractice: false,
      isShowcase: false,
      isActive: true,
      appMode: "caregiver",
      clientUserId: userId, // self-linked: this user IS the client
    }).returning().get();
    // Link user row → client, set role + permissionLevel, record clientUserId
    db.update(users).set({
      clientId: client.id,
      role: "self_care",
      permissionLevel: "self_care_mc",
    }).where(eq(users.id, userId)).run();
    return client;
  },

  // Client Empowerment
  linkClientUser: (clientId, userId) =>
    db.update(clients).set({ clientUserId: userId }).where(eq(clients.id, clientId)).returning().get(),
  unlinkClientUser: (clientId) =>
    db.update(clients).set({ clientUserId: null }).where(eq(clients.id, clientId)).returning().get(),
  setClientPermissionLevel: (userId, level) =>
    db.update(users).set({ permissionLevel: level }).where(eq(users.id, userId)).returning().get(),
  getClientByClientUserId: (userId) =>
    db.select().from(clients).where(eq(clients.clientUserId, userId)).get(),

  // Phase 3 — Transfer of Care
  initiateTransfer: (clientId, initiatedBy) => {
    const now = new Date().toISOString();
    const patch: Partial<Client> = {
      transferInitiatedBy: initiatedBy,
      transferStep: 1,
      transferMCCoConfirmed: false,
      transferCancelledAt: null,
      transferOfferedAt: initiatedBy === 'mc' ? now : null,
      ownershipTransferInitiatedAt: now,
    };
    return db.update(clients).set(patch).where(eq(clients.id, clientId)).returning().get();
  },

  advanceTransferStep: (clientId, step) =>
    db.update(clients).set({
      transferStep: step,
      ...(step === 2 ? { transferStep2At: new Date().toISOString() } : {}),
    }).where(eq(clients.id, clientId)).returning().get(),

  mcCoConfirmTransfer: (clientId) =>
    db.update(clients).set({ transferMCCoConfirmed: true }).where(eq(clients.id, clientId)).returning().get(),

  cancelTransfer: (clientId) =>
    db.update(clients).set({
      transferStep: 0,
      transferInitiatedBy: null,
      transferMCCoConfirmed: false,
      transferOfferedAt: null,
      transferStep2At: null,
      transferCancelledAt: new Date().toISOString(),
      ownershipTransferInitiatedAt: null,
    }).where(eq(clients.id, clientId)).returning().get(),

  executeTransfer: (clientId, mcPostTransferRole) => {
    const client = db.select().from(clients).where(eq(clients.id, clientId)).get();
    if (!client || !client.clientUserId) return undefined;
    // Promote the self_care user to self_care_mc
    const clientUser = db.update(users)
      .set({ permissionLevel: 'self_care_mc', contributorWelcomeSeen: true })
      .where(eq(users.id, client.clientUserId))
      .returning().get();
    // Demote the original MC (primary_contact) to secondary_family
    let oldMcUser: User | undefined;
    if (client.primaryContactId) {
      oldMcUser = db.update(users)
        .set({ role: 'secondary_family' })
        .where(eq(users.id, client.primaryContactId))
        .returning().get();
    }
    // Stamp the client record
    const now = new Date().toISOString();
    const updatedClient = db.update(clients).set({
      transferStep: 0,
      ownershipTransferConfirmedAt: now,
      mcPostTransferRole,
      transferMCCoConfirmed: false,
      transferOfferedAt: null,
      transferStep2At: null,
    }).where(eq(clients.id, clientId)).returning().get();
    return { client: updatedClient!, oldMcUser, clientUser };
  },

  getTransferStatus: (clientId) => {
    const client = db.select().from(clients).where(eq(clients.id, clientId)).get();
    if (!client) return undefined;
    return {
      step: client.transferStep ?? 0,
      initiatedBy: client.transferInitiatedBy ?? null,
      offeredAt: client.transferOfferedAt ?? null,
      step2At: client.transferStep2At ?? null,
      mcCoConfirmed: client.transferMCCoConfirmed ?? false,
      cancelledAt: client.transferCancelledAt ?? null,
      confirmedAt: client.ownershipTransferConfirmedAt ?? null,
    };
  },

  // Schedule Events
  getScheduleEventsByClient: (clientId) => db.select().from(scheduleEvents).where(eq(scheduleEvents.clientId, clientId)).orderBy(asc(scheduleEvents.scheduledAt)).all(),
  getScheduleEventById: (id) => db.select().from(scheduleEvents).where(eq(scheduleEvents.id, id)).get(),
  createScheduleEvent: (data) => db.insert(scheduleEvents).values(data).returning().get(),
  updateScheduleEvent: (id, data) => db.update(scheduleEvents).set(data).where(eq(scheduleEvents.id, id)).returning().get(),
  deleteScheduleEvent: (id) => { db.delete(scheduleEvents).where(eq(scheduleEvents.id, id)).run(); },

  // Activity Logs
  getActivityLogsByClient: (clientId) => db.select().from(activityLogs).where(eq(activityLogs.clientId, clientId)).orderBy(desc(activityLogs.loggedAt)).all(),
  getActivityLogById: (id) => db.select().from(activityLogs).where(eq(activityLogs.id, id)).get(),
  createActivityLog: (data) => db.insert(activityLogs).values(data).returning().get(),
  updateActivityLog: (id, data) => db.update(activityLogs).set(data).where(eq(activityLogs.id, id)).returning().get(),
  deleteActivityLog: (id) => { db.delete(activityLogs).where(eq(activityLogs.id, id)).run(); },
  excuseActivityLog: (id, excuseNote, excusedByUserId) => db.update(activityLogs).set({ isExcused: true, excuseNote, excusedByUserId }).where(eq(activityLogs.id, id)).returning().get(),
  // Addendums
  getAddendumsByActivityLog: (activityLogId: number): ActivityLogAddendum[] =>
    db.select().from(activityLogAddendums).where(eq(activityLogAddendums.activityLogId, activityLogId)).orderBy(asc(activityLogAddendums.createdAt)).all(),
  createAddendum: (data: { activityLogId: number; authorUserId: number; tag: string; note: string; struckText?: string; correctedText?: string; initials?: string; createdAt: string }): ActivityLogAddendum =>
    db.insert(activityLogAddendums).values(data).returning().get(),

  // Chat Threads
  getChatThreadsByClient: (clientId) => db.select().from(chatThreads).where(eq(chatThreads.clientId, clientId)).all(),
  getChatThreadById: (id) => db.select().from(chatThreads).where(eq(chatThreads.id, id)).get(),
  createChatThread: (data) => db.insert(chatThreads).values(data).returning().get(),
  updateChatThread: (id, data) => db.update(chatThreads).set(data).where(eq(chatThreads.id, id)).returning().get(),

  // Messages
  getMessagesByThread: (threadId) => db.select().from(messages).where(eq(messages.threadId, threadId)).orderBy(asc(messages.sentAt)).all(),
  getMessageById: (id) => db.select().from(messages).where(eq(messages.id, id)).get(),
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
  getMediaItemById: (id) => db.select().from(mediaItems).where(eq(mediaItems.id, id)).get(),
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
  // Finds caregivers via BOTH users.clientId (single-portal CGs) and
  // user_client_relationships (multi-portal CGs linked via admin)
  getCaregiversByClientId: (clientId) => {
    const cgRoles = ['caregiver','temp_caregiver','multi_caregiver'];
    // Primary path: users whose clientId column points here
    const direct = db.select().from(users)
      .where(eq(users.clientId, clientId))
      .all()
      .filter(u => cgRoles.includes(u.role) && u.isActive !== false);
    // Secondary path: users linked via userClientRelationships (multi-portal CGs)
    // Raw SQLite returns snake_case columns — map them to camelCase to match Drizzle output
    const linkedRaw = sqlite.prepare(`
      SELECT u.* FROM users u
      INNER JOIN user_client_relationships ucr ON ucr.user_id = u.id
      WHERE ucr.client_id = ? AND ucr.role = 'caregiver'
        AND u.is_active IS NOT 0
    `).all(clientId) as Record<string, unknown>[];
    const linked = linkedRaw.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role,
      email: r.email,
      phone: r.phone ?? null,
      avatarInitials: r.avatar_initials ?? null,
      clientId: r.client_id,
      notificationPrefs: r.notification_prefs ?? null,
      fontSizePreference: r.font_size_preference ?? 'normal',
      isActive: r.is_active !== 0,
      onboardingCompletedAt: r.onboarding_completed_at ?? null,
      mcSetupCompletedAt: r.mc_setup_completed_at ?? null,
      carePathChoice: r.care_path_choice ?? null,
      tempAccessStart: r.temp_access_start ?? null,
      tempAccessEnd: r.temp_access_end ?? null,
      tempAccessReason: r.temp_access_reason ?? null,
      seenModules: r.seen_modules ?? '[]',
      navOrder: r.nav_order ?? '[]',
      timezone: r.timezone ?? null,
      sampleClientId: r.sample_client_id ?? null,
      permissionLevel: r.permission_level ?? null,
      contributorWelcomeSeen: r.contributor_welcome_seen === 1,
      multiPortalNudgeSnoozedUntil: r.multi_portal_nudge_snoozed_until ?? null,
      mcBannerSnoozedUntil: r.mc_banner_snoozed_until ?? null,
      elevatedUntil: r.elevated_until ?? null,
      hasSeenMcInvitePrompt: r.has_seen_mc_invite_prompt === 1,
    })) as typeof direct;
    // Merge, deduplicate by id
    const seen = new Set(direct.map(u => u.id));
    const extra = linked.filter(u => !seen.has(u.id) && cgRoles.includes(u.role as string));
    return [...direct, ...extra];
  },

  // Misc Notes
  getMiscNotesByClient: (clientId) => db.select().from(miscNotes).where(eq(miscNotes.clientId, clientId)).orderBy(desc(miscNotes.createdAt)).all(),
  getMiscNoteById: (id) => db.select().from(miscNotes).where(eq(miscNotes.id, id)).get(),
  createMiscNote: (data) => db.insert(miscNotes).values(data).returning().get(),
  updateMiscNote: (id, data) => db.update(miscNotes).set(data).where(eq(miscNotes.id, id)).returning().get(),
  deleteMiscNote: (id) => { db.delete(miscNotes).where(eq(miscNotes.id, id)).run(); },

  // Documents
  getDocumentsByClient: (clientId) => db.select().from(documents).where(eq(documents.clientId, clientId)).orderBy(desc(documents.uploadedAt)).all(),
  getDocumentById: (id) => db.select().from(documents).where(eq(documents.id, id)).get(),
  createDocument: (data) => db.insert(documents).values(data).returning().get(),
  deleteDocument: (id) => { db.delete(documents).where(eq(documents.id, id)).run(); },
  updateDocumentAccess: (id, cgAccess) => db.update(documents).set({ cgAccess }).where(eq(documents.id, id)).returning().get(),
  logDocumentAccess: (docId, userId, action) => db.insert(documentAccessLog).values({ docId, userId, action, accessedAt: new Date().toISOString() }).returning().get(),
  getDocumentAccessLog: (docId) => db.select().from(documentAccessLog).where(eq(documentAccessLog.docId, docId)).orderBy(desc(documentAccessLog.accessedAt)).all(),

  // Outings
  getOutingsByClient: (clientId) => db.select().from(outings).where(eq(outings.clientId, clientId)).orderBy(desc(outings.startedAt)).all(),
  getOutingById: (id) => db.select().from(outings).where(eq(outings.id, id)).get(),
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
  getVitalById: (id) => db.select().from(vitals).where(eq(vitals.id, id)).get(),
  createVitals: (data) => db.insert(vitals).values(data).returning().get(),
  updateVital: (id, data) => db.update(vitals).set(data).where(eq(vitals.id, id)).returning().get(),

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

  // Emergency Alerts
  createEmergencyAlert: (data) => db.insert(emergencyAlerts).values(data).returning().get(),
  getEmergencyAlertsByClient: (clientId) => db.select().from(emergencyAlerts).where(eq(emergencyAlerts.clientId, clientId)).all(),
  markReminderSent: (alertId) => db.update(emergencyAlerts).set({ reminderSent: true }).where(eq(emergencyAlerts.id, alertId)).run(),

  // Ideas
  createIdea: (data) => db.insert(ideas).values(data).returning().get(),
  getAllIdeas: () => db.select().from(ideas).orderBy(desc(ideas.createdAt)).all(),
  getIdeasByCluster: () => {
    const all = db.select().from(ideas).orderBy(desc(ideas.createdAt)).all();
    const clusterMap = new Map<string, { clusterLabel: string; ideas: Idea[] }>();
    for (const idea of all) {
      const key = idea.clusterId || "unclustered";
      const label = idea.clusterLabel || "Unclustered";
      if (!clusterMap.has(key)) clusterMap.set(key, { clusterLabel: label, ideas: [] });
      clusterMap.get(key)!.ideas.push(idea);
    }
    return Array.from(clusterMap.entries())
      .map(([clusterId, { clusterLabel, ideas }]) => ({ clusterId, clusterLabel, count: ideas.length, ideas }))
      .sort((a, b) => b.count - a.count);
  },
  updateIdea: (id, data) => db.update(ideas).set(data).where(eq(ideas.id, id)).returning().get(),
};

storage.seedBeckyResponsesIfEmpty();

// ── Connection Invites Migration ──────────────────────────────────────────────
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS connection_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    sender_user_id INTEGER NOT NULL,
    sender_role TEXT NOT NULL,
    client_id INTEGER,
    client_name TEXT,
    sender_name TEXT NOT NULL,
    invited_email TEXT,
    invite_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    accepted_by_user_id INTEGER,
    accepted_at TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
} catch { /* already exists */ }

// Notification prefs column on users
try { sqlite.exec(`ALTER TABLE users ADD COLUMN notification_prefs TEXT DEFAULT '{"careLog":true,"messages":true,"schedule":true,"vitals":false}'`); } catch { /* already exists */ }

// seenModules migration moved to early migration block (line ~339) to avoid startup crash

// ── Care Directory Migration ──────────────────────────────────────────────────
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS emergency_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    triggered_by_user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    sms_to_mc INTEGER DEFAULT 1,
    sms_to_cg INTEGER DEFAULT 0,
    sms_sent INTEGER DEFAULT 0,
    reminder_sent INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )`);
} catch { /* already exists */ }
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS care_directory_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
} catch { /* already exists */ }

// ── colorTheme column on clients ─────────────────────────────────────
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN color_theme TEXT DEFAULT 'teal'`); } catch { /* already exists */ }

// ── Multi-portal nudge snooze column on users ──────────────────────────
try { sqlite.exec(`ALTER TABLE users ADD COLUMN multi_portal_nudge_snoozed_until TEXT`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE users ADD COLUMN elevated_until TEXT`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE users ADD COLUMN has_seen_mc_invite_prompt INTEGER DEFAULT 0`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE users ADD COLUMN mc_banner_snoozed_until TEXT`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE auth_accounts ADD COLUMN login_count INTEGER DEFAULT 0`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE users ADD COLUMN has_seen_high_five INTEGER DEFAULT 0`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE users ADD COLUMN has_seen_open_hand INTEGER DEFAULT 0`); } catch { /* already exists */ }

// ── Subscription billing columns on clients ─────────────────────────────────────
 try { sqlite.exec(`ALTER TABLE clients ADD COLUMN subscription_status TEXT DEFAULT 'trial'`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN square_customer_id TEXT`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN square_card_id TEXT`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN square_subscription_id TEXT`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN subscription_started_at TEXT`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN subscription_renews_at TEXT`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN grace_period_ends_at TEXT`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN trial_started_at TEXT`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE clients ADD COLUMN founder_tier TEXT DEFAULT 'standard'`); } catch { /* already exists */ }
// NOTE: One-time beta-stamp migration removed July 13, 2026 — all pre-billing portals
// were already grandfathered. Running this on every restart would flip paying
// standard-tier clients to free-for-life after Dec 31 2026. Do not restore.

// ── User-Client Relationships Migration ────────────────────────────────
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS user_client_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    is_primary INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )`);
} catch { /* already exists */ }

// ── Seed junction table from existing users ────────────────────────────────
try {
  const existing = sqlite.prepare(`SELECT COUNT(*) as cnt FROM user_client_relationships`).get() as any;
  if (existing.cnt === 0) {
    // Seed all users who have a clientId into the junction table
    const usersWithClient = sqlite.prepare(
      `SELECT id, client_id, role FROM users WHERE client_id IS NOT NULL AND is_active = 1`
    ).all() as any[];
    const insert = sqlite.prepare(
      `INSERT INTO user_client_relationships (user_id, client_id, role, is_primary, created_at) VALUES (?, ?, ?, 1, ?)`
    );
    const now = new Date().toISOString();
    for (const u of usersWithClient) {
      const ucRole = u.role === 'primary_family' ? 'mc'
        : u.role === 'secondary_family' ? 'secondary_family'
        : u.role === 'self_care' ? 'self_care'
        : 'caregiver';
      insert.run(u.id, u.client_id, ucRole, now);
    }
    console.log(`[startup] Seeded ${usersWithClient.length} user-client relationships`);
  }
} catch (e: any) { console.warn('[startup] Junction seed error:', e?.message); }

// ── Health History Migration ────────────────────────────────────────────────
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS health_history_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    added_by_user_id INTEGER NOT NULL,
    entry_type TEXT NOT NULL,
    title TEXT NOT NULL,
    date_approx TEXT,
    date_year INTEGER,
    date_month INTEGER,
    date_day INTEGER,
    facility TEXT,
    provider TEXT,
    outcome TEXT,
    notes TEXT,
    is_significant INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )`);
} catch { /* already exists */ }

// ── User Feedback Migration ─────────────────────────────────────────────────
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS user_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    user_role TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    message TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL
  )`);
} catch { /* already exists */ }

// ── Ideas Migration ───────────────────────────────────────────────────────────
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_role TEXT,
    text TEXT NOT NULL,
    page TEXT,
    care_context TEXT,
    idea_type TEXT,
    cluster_id TEXT,
    cluster_label TEXT,
    gemini_summary TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    admin_note TEXT,
    created_at TEXT NOT NULL
  )`);
} catch { /* already exists */ }

// ── Promo Codes Migration ────────────────────────────────────────────────────
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS promo_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    discount_type TEXT NOT NULL,
    discount_value INTEGER,
    max_uses INTEGER,
    expires_at TEXT,
    active INTEGER DEFAULT 1,
    created_by_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`);
} catch { /* already exists */ }

try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS promo_code_uses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    promo_code_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    applied_by_user_id INTEGER NOT NULL,
    applied_at TEXT NOT NULL,
    note TEXT
  )`);
} catch { /* already exists */ }

try { sqlite.exec(`ALTER TABLE clients ADD COLUMN promo_discount_percent INTEGER`); } catch { /* already exists */ }

// activity_log_addendums — strikethrough fields (September 2026)
try { sqlite.exec(`ALTER TABLE activity_log_addendums ADD COLUMN struck_text TEXT`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE activity_log_addendums ADD COLUMN corrected_text TEXT`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE activity_log_addendums ADD COLUMN initials TEXT`); } catch { /* already exists */ }
