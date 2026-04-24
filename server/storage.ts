import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  users, clients, scheduleEvents, activityLogs, chatThreads,
  messages, mediaItems, notifications, archiveSummaries,
  type User, type InsertUser,
  type Client, type InsertClient,
  type ScheduleEvent, type InsertScheduleEvent,
  type ActivityLog, type InsertActivityLog,
  type ChatThread, type InsertChatThread,
  type Message, type InsertMessage,
  type MediaItem, type InsertMediaItem,
  type Notification, type InsertNotification,
  type ArchiveSummary, type InsertArchiveSummary,
} from "@shared/schema";

const sqlite = new Database("data.db");
const db = drizzle(sqlite);

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
    is_active INTEGER DEFAULT 1
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
    is_active INTEGER DEFAULT 1
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
    is_read INTEGER DEFAULT 0
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
    highlights TEXT,
    generated_at TEXT NOT NULL
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

  // Chat Threads
  getChatThreadsByClient(clientId: number): ChatThread[];
  getChatThreadById(id: number): ChatThread | undefined;
  createChatThread(data: InsertChatThread): ChatThread;
  updateChatThread(id: number, data: Partial<InsertChatThread>): ChatThread | undefined;

  // Messages
  getMessagesByThread(threadId: number): Message[];
  createMessage(data: InsertMessage): Message;

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
}

function seedIfEmpty() {
  const existingUsers = db.select().from(users).all();
  if (existingUsers.length > 0) return;

  const now = new Date().toISOString();
  const today = new Date();

  // Seed users
  db.insert(users).values([
    { name: "Becky M.", role: "caregiver", email: "becky@carenportal.com", phone: "555-0101", avatarInitials: "BM", clientId: null, notificationPrefs: '{"all":true}', isActive: true },
    { name: "Robert Johnson Sr.", role: "primary_family", email: "robert.jr@email.com", phone: "555-0102", avatarInitials: "RJ", clientId: 1, notificationPrefs: '{"all":true}', isActive: true },
    { name: "Linda Johnson", role: "secondary_family", email: "linda.j@email.com", phone: "555-0103", avatarInitials: "LJ", clientId: 1, notificationPrefs: '{"medications":true,"alerts":true}', isActive: true },
    { name: "Sarah Williams", role: "primary_family", email: "sarah.w@email.com", phone: "555-0104", avatarInitials: "SW", clientId: 2, notificationPrefs: '{"all":true}', isActive: true },
    { name: "Tom Williams", role: "secondary_family", email: "tom.w@email.com", phone: "555-0105", avatarInitials: "TW", clientId: 2, notificationPrefs: '{"alerts":true}', isActive: true },
  ]).run();

  // Seed clients
  db.insert(clients).values([
    { name: "Robert Johnson", dateOfBirth: "1942-03-15", primaryCondition: "Post-stroke recovery, mild cognitive impairment", allergies: '["Penicillin","Sulfa drugs"]', notes: "Prefers morning routines early. Enjoys classical music. Has a small dog named Max.", caregiverId: 1, primaryContactId: 2, isActive: true },
    { name: "Eleanor Williams", dateOfBirth: "1938-11-22", primaryCondition: "Parkinson's disease, Type 2 diabetes", allergies: '["Shellfish","Aspirin"]', notes: "Very independent spirit. Needs reminders but resists help. Loves gardening conversation.", caregiverId: 1, primaryContactId: 4, isActive: true },
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

  console.log("✅ Database seeded with sample data");
}

seedIfEmpty();

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

  // Chat Threads
  getChatThreadsByClient: (clientId) => db.select().from(chatThreads).where(eq(chatThreads.clientId, clientId)).all(),
  getChatThreadById: (id) => db.select().from(chatThreads).where(eq(chatThreads.id, id)).get(),
  createChatThread: (data) => db.insert(chatThreads).values(data).returning().get(),
  updateChatThread: (id, data) => db.update(chatThreads).set(data).where(eq(chatThreads.id, id)).returning().get(),

  // Messages
  getMessagesByThread: (threadId) => db.select().from(messages).where(eq(messages.threadId, threadId)).orderBy(asc(messages.sentAt)).all(),
  createMessage: (data) => db.insert(messages).values(data).returning().get(),

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
};
