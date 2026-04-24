import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles: caregiver | primary_family | secondary_family
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'caregiver' | 'primary_family' | 'secondary_family'
  email: text("email").notNull(),
  phone: text("phone"),
  avatarInitials: text("avatar_initials"),
  clientId: integer("client_id"), // which client this family member belongs to (null for caregiver)
  notificationPrefs: text("notification_prefs").default('{"all":true}'), // JSON string
  isActive: integer("is_active", { mode: "boolean" }).default(true),
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
  allergies: text("allergies"), // JSON array string
  notes: text("notes"),
  caregiverId: integer("caregiver_id").notNull(),
  primaryContactId: integer("primary_contact_id"), // user id of primary family contact
  isActive: integer("is_active", { mode: "boolean" }).default(true),
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
  highlights: text("highlights"), // JSON array of key events
  generatedAt: text("generated_at").notNull(),
});

export const insertArchiveSummarySchema = createInsertSchema(archiveSummaries).omit({ id: true });
export type InsertArchiveSummary = z.infer<typeof insertArchiveSummarySchema>;
export type ArchiveSummary = typeof archiveSummaries.$inferSelect;
