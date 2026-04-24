import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";

export function registerRoutes(httpServer: Server, app: Express) {
  // Users
  app.get("/api/users", (_, res) => res.json(storage.getUsers()));
  app.get("/api/users/:id", (req, res) => {
    const user = storage.getUserById(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  });
  app.get("/api/clients/:clientId/family", (req, res) => {
    res.json(storage.getUsersByClientId(Number(req.params.clientId)));
  });
  app.post("/api/users", (req, res) => {
    const user = storage.createUser(req.body);
    res.status(201).json(user);
  });
  app.patch("/api/users/:id", (req, res) => {
    const user = storage.updateUser(Number(req.params.id), req.body);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  });

  // Clients
  app.get("/api/clients", (_, res) => res.json(storage.getClients()));
  app.get("/api/clients/:id", (req, res) => {
    const client = storage.getClientById(Number(req.params.id));
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  });
  app.post("/api/clients", (req, res) => {
    const client = storage.createClient(req.body);
    res.status(201).json(client);
  });
  app.patch("/api/clients/:id", (req, res) => {
    const client = storage.updateClient(Number(req.params.id), req.body);
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  });

  // Schedule Events
  app.get("/api/clients/:clientId/schedule", (req, res) => {
    res.json(storage.getScheduleEventsByClient(Number(req.params.clientId)));
  });
  app.post("/api/clients/:clientId/schedule", (req, res) => {
    const event = storage.createScheduleEvent({ ...req.body, clientId: Number(req.params.clientId) });
    res.status(201).json(event);
  });
  app.patch("/api/schedule/:id", (req, res) => {
    const event = storage.updateScheduleEvent(Number(req.params.id), req.body);
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  });
  app.delete("/api/schedule/:id", (req, res) => {
    storage.deleteScheduleEvent(Number(req.params.id));
    res.json({ success: true });
  });

  // Activity Logs
  app.get("/api/clients/:clientId/activity", (req, res) => {
    res.json(storage.getActivityLogsByClient(Number(req.params.clientId)));
  });
  app.post("/api/clients/:clientId/activity", (req, res) => {
    const log = storage.createActivityLog({ ...req.body, clientId: Number(req.params.clientId) });
    res.status(201).json(log);
  });
  app.patch("/api/activity/:id", (req, res) => {
    const log = storage.updateActivityLog(Number(req.params.id), req.body);
    if (!log) return res.status(404).json({ message: "Log not found" });
    res.json(log);
  });
  app.delete("/api/activity/:id", (req, res) => {
    storage.deleteActivityLog(Number(req.params.id));
    res.json({ success: true });
  });

  // Chat Threads
  app.get("/api/clients/:clientId/threads", (req, res) => {
    res.json(storage.getChatThreadsByClient(Number(req.params.clientId)));
  });
  app.post("/api/clients/:clientId/threads", (req, res) => {
    const thread = storage.createChatThread({ ...req.body, clientId: Number(req.params.clientId) });
    res.status(201).json(thread);
  });
  app.patch("/api/threads/:id", (req, res) => {
    const thread = storage.updateChatThread(Number(req.params.id), req.body);
    if (!thread) return res.status(404).json({ message: "Thread not found" });
    res.json(thread);
  });

  // Messages
  app.get("/api/threads/:threadId/messages", (req, res) => {
    res.json(storage.getMessagesByThread(Number(req.params.threadId)));
  });
  app.post("/api/threads/:threadId/messages", (req, res) => {
    const msg = storage.createMessage({ ...req.body, threadId: Number(req.params.threadId) });
    res.status(201).json(msg);
  });

  // Media
  app.get("/api/clients/:clientId/media", (req, res) => {
    res.json(storage.getMediaByClient(Number(req.params.clientId)));
  });
  app.post("/api/clients/:clientId/media", (req, res) => {
    const item = storage.createMediaItem({ ...req.body, clientId: Number(req.params.clientId) });
    res.status(201).json(item);
  });
  app.delete("/api/media/:id", (req, res) => {
    storage.deleteMediaItem(Number(req.params.id));
    res.json({ success: true });
  });

  // Notifications
  app.get("/api/users/:userId/notifications", (req, res) => {
    res.json(storage.getNotificationsByUser(Number(req.params.userId)));
  });
  app.patch("/api/notifications/:id/read", (req, res) => {
    storage.markNotificationRead(Number(req.params.id));
    res.json({ success: true });
  });
  app.patch("/api/users/:userId/notifications/read-all", (req, res) => {
    storage.markAllNotificationsRead(Number(req.params.userId));
    res.json({ success: true });
  });

  // Archive Summaries
  app.get("/api/clients/:clientId/archive", (req, res) => {
    res.json(storage.getArchiveSummariesByClient(Number(req.params.clientId)));
  });
  app.post("/api/clients/:clientId/archive", (req, res) => {
    const summary = storage.createArchiveSummary({ ...req.body, clientId: Number(req.params.clientId) });
    res.status(201).json(summary);
  });
}
