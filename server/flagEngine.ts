/**
 * Care Net Portal — Flag Engine
 *
 * Runs scheduled checks to auto-generate yellow care flags for:
 *   1. Medication events not completed within 1 hour of scheduled time
 *   2. Appointment events (caregiverResponsible=true) not completed by end of day
 *   3. High-priority messages unread by the caregiver after 4 hours (only during an active shift)
 *
 * Red flag escalation (3 unexcused yellows in same category within 30 days) is handled
 * at creation time in routes.ts — no separate check needed here.
 */

import { storage } from "./storage";

// Helper: fetch flag control settings, defaulting to all-enabled
function getFlagControl(caregiverId: number, clientId: number) {
  const fc = storage.getFlagControl(clientId, caregiverId);
  return {
    medicationFlags: fc?.medicationFlags ?? true,
    appointmentFlags: fc?.appointmentFlags ?? true,
    messageFlags: fc?.messageFlags ?? true,
  };
}

const MEDICATION_GRACE_MS = 60 * 60 * 1000;       // 1 hour
const MESSAGE_UNREAD_GRACE_MS = 4 * 60 * 60 * 1000; // 4 hours
const DAY_END_HOUR = 23; // 11 PM — considered "end of day" for appointments

function todayEOD(): Date {
  const d = new Date();
  d.setHours(DAY_END_HOUR, 59, 59, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function alreadyFlagged(
  caregiverId: number,
  clientId: number,
  category: string,
  referenceId: number,
  referenceType: string
): boolean {
  // Check if a flag already exists for this exact reference
  const flags = storage.getCareFlagsByCaregiver(caregiverId, clientId);
  return flags.some(f =>
    f.category === category &&
    f.referenceId === referenceId &&
    f.referenceType === referenceType &&
    f.flagType === "yellow"
  );
}

export function runFlagEngine() {
  const now = new Date();
  console.log(`[FlagEngine] Running at ${now.toISOString()}`);

  try {
    // ── 1. Medication late flag ─────────────────────────────────────────────
    // Get all clients, then their schedule events
    const clients = storage.getClients();

    for (const client of clients) {
      if (!client.caregiverId) continue;
      const caregiverId = client.caregiverId;

      const events = storage.getScheduleEventsByClient(client.id);

      // Fetch flag control settings for this caregiver/client pair
      const flagCtrl = getFlagControl(caregiverId, client.id);

      // -- Medication: not logged within 1hr of scheduled time
      const medicationEvents = events.filter(e =>
        e.type === "medication" &&
        !e.isCompleted
      );

      for (const evt of medicationEvents) {
        if (!flagCtrl.medicationFlags) continue; // family has disabled medication flags
        const scheduled = new Date(evt.scheduledAt);
        const elapsed = now.getTime() - scheduled.getTime();

        // Only flag if scheduled time has passed by > 1 hour and is within the last 24h (avoid flagging old orphans repeatedly)
        if (elapsed > MEDICATION_GRACE_MS && elapsed < 24 * 60 * 60 * 1000) {
          if (!alreadyFlagged(caregiverId, client.id, "medication", evt.id, "schedule_event")) {
            storage.createCareFlag({
              clientId: client.id,
              caregiverId,
              flagType: "yellow",
              category: "medication",
              reason: `Medication "${evt.title}" was not logged within 1 hour of the scheduled time (${new Date(evt.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}).`,
              referenceId: evt.id,
              referenceType: "schedule_event",
              triggeredAt: now.toISOString(),
            });
            // Check red flag escalation
            const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const count = storage.getUnexcusedFlagCount(caregiverId, client.id, "medication", since);
            if (count >= 3) {
              const existingRed = storage.getCareFlagsByCaregiver(caregiverId, client.id)
                .filter(f => f.flagType === "red" && f.category === "medication")
                .filter(f => new Date(f.triggeredAt) > new Date(since));
              if (existingRed.length === 0) {
                storage.createCareFlag({
                  clientId: client.id,
                  caregiverId,
                  flagType: "red",
                  category: "medication",
                  reason: `3 unexcused yellow flags in "medication" within 30 days — escalated to red flag.`,
                  referenceId: evt.id,
                  referenceType: "care_flag",
                  triggeredAt: now.toISOString(),
                });
              }
            }
            console.log(`[FlagEngine] Yellow flag: medication late — event ${evt.id} for client ${client.id}`);
          }
        }
      }

      // -- Appointment: caregiverResponsible=true, not completed by EOD
      const eod = todayEOD();
      if (now >= eod) {
        const apptEvents = events.filter(e =>
          e.type === "appointment" &&
          e.caregiverResponsible !== false && // null/undefined treated as true
          !e.isCompleted &&
          isSameDay(new Date(e.scheduledAt), now)
        );

        for (const evt of apptEvents) {
          if (!flagCtrl.appointmentFlags) continue; // family has disabled appointment flags
          if (!alreadyFlagged(caregiverId, client.id, "appointment", evt.id, "schedule_event")) {
            storage.createCareFlag({
              clientId: client.id,
              caregiverId,
              flagType: "yellow",
              category: "appointment",
              reason: `Appointment "${evt.title}" was not marked complete by end of day.`,
              referenceId: evt.id,
              referenceType: "schedule_event",
              triggeredAt: now.toISOString(),
            });
            // Red flag escalation
            const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const count = storage.getUnexcusedFlagCount(caregiverId, client.id, "appointment", since);
            if (count >= 3) {
              const existingRed = storage.getCareFlagsByCaregiver(caregiverId, client.id)
                .filter(f => f.flagType === "red" && f.category === "appointment")
                .filter(f => new Date(f.triggeredAt) > new Date(since));
              if (existingRed.length === 0) {
                storage.createCareFlag({
                  clientId: client.id,
                  caregiverId,
                  flagType: "red",
                  category: "appointment",
                  reason: `3 unexcused yellow flags in "appointment" within 30 days — escalated to red flag.`,
                  referenceId: evt.id,
                  referenceType: "care_flag",
                  triggeredAt: now.toISOString(),
                });
              }
            }
            console.log(`[FlagEngine] Yellow flag: appointment incomplete EOD — event ${evt.id} for client ${client.id}`);
          }
        }
      }

      // -- Message: high-priority unread after 4hrs, only if caregiver is on shift
      const activeShift = storage.getActiveShift(caregiverId, client.id);
      if (activeShift) {
        // Get all threads for this client, find high-priority messages sent during shift window
        const threads = storage.getChatThreadsByClient(client.id);
        for (const thread of threads) {
          const msgs = storage.getMessagesByThread(thread.id);
          const highPriMsgs = msgs.filter(m =>
            m.priority === "red" &&
            !m.isRead &&
            m.senderId !== caregiverId // sent by someone else
          );

          for (const msg of highPriMsgs) {
            if (!flagCtrl.messageFlags) continue; // family has disabled message flags
            const sentAt = new Date(msg.sentAt).getTime();
            // Only flag if message was sent during the current shift
            const shiftStart = new Date(activeShift.clockInAt).getTime();
            if (sentAt < shiftStart) continue;

            const elapsed = now.getTime() - sentAt;
            if (elapsed > MESSAGE_UNREAD_GRACE_MS) {
              if (!alreadyFlagged(caregiverId, client.id, "messages", msg.id, "message")) {
                storage.createCareFlag({
                  clientId: client.id,
                  caregiverId,
                  flagType: "yellow",
                  category: "messages",
                  reason: `Urgent message (ID ${msg.id}) in thread "${thread.name}" was not read within 4 hours while caregiver was on shift.`,
                  referenceId: msg.id,
                  referenceType: "message",
                  triggeredAt: now.toISOString(),
                });
                // Red flag escalation
                const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
                const count = storage.getUnexcusedFlagCount(caregiverId, client.id, "messages", since);
                if (count >= 3) {
                  const existingRed = storage.getCareFlagsByCaregiver(caregiverId, client.id)
                    .filter(f => f.flagType === "red" && f.category === "messages")
                    .filter(f => new Date(f.triggeredAt) > new Date(since));
                  if (existingRed.length === 0) {
                    storage.createCareFlag({
                      clientId: client.id,
                      caregiverId,
                      flagType: "red",
                      category: "messages",
                      reason: `3 unexcused yellow flags in "messages" within 30 days — escalated to red flag.`,
                      referenceId: msg.id,
                      referenceType: "care_flag",
                      triggeredAt: now.toISOString(),
                    });
                  }
                }
                console.log(`[FlagEngine] Yellow flag: urgent message unread — msg ${msg.id} for client ${client.id}`);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[FlagEngine] Error:", err);
  }
}

/**
 * Start the flag engine on a scheduled interval.
 * Runs every 15 minutes.
 */
export function startFlagEngine() {
  const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
  console.log("[FlagEngine] Starting — will run every 15 minutes");
  runFlagEngine(); // run immediately on startup
  setInterval(runFlagEngine, INTERVAL_MS);
}
