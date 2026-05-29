import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { startFlagEngine } from "./flagEngine";
import { createServer } from "node:http";
import { sqlite } from "./db";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Log method, path, status, and timing only — never log response bodies (PHI risk)
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  // One-time cleanup: delete orphaned client 23 (Donielle/McKenzie ghost portal)
  try {
    const usersOnClient23 = sqlite.prepare(`SELECT id FROM users WHERE client_id = 23`).all();
    if (usersOnClient23.length === 0) {
      sqlite.prepare(`DELETE FROM clients WHERE id = 23`).run();
      console.log("[startup] Deleted orphaned client 23");
    }
  } catch (e) { /* already gone or never existed */ }

  // One-time fix: Madysen (user 57) signed up as caregiver but is secondary_family on client 24
  // Also ensure userClientRelationships row exists for Care Home multi-portal support
  try {
    const mad = sqlite.prepare(`SELECT role, clientId FROM users WHERE id = 57`).get() as any;
    if (mad) {
      if (mad.role !== 'secondary_family') {
        sqlite.prepare(`UPDATE users SET role = 'secondary_family' WHERE id = 57`).run();
        console.log('[startup] Fixed Madysen (user 57) role -> secondary_family');
      }
      const relExists = sqlite.prepare(`SELECT id FROM user_client_relationships WHERE userId = 57 AND clientId = 24`).get();
      if (!relExists) {
        const relCount = (sqlite.prepare(`SELECT COUNT(*) as c FROM user_client_relationships WHERE userId = 57`).get() as any).c;
        sqlite.prepare(`INSERT INTO user_client_relationships (userId, clientId, role, isPrimary, createdAt) VALUES (57, 24, 'secondary_family', ?, ?)`).run(relCount === 0 ? 1 : 0, new Date().toISOString());
        console.log('[startup] Added userClientRelationships row for Madysen (user 57) -> client 24');
      }
    }
  } catch (e) { console.error('[startup] Madysen fix error:', e); }

  // One-time fix: correct McKenzie (user 50) role from primary_family -> self_care
  // She arrived via self_care path but was stored incorrectly
  try {
    const mck = sqlite.prepare(`SELECT role FROM users WHERE id = 50`).get() as any;
    if (mck && mck.role !== 'self_care') {
      sqlite.prepare(`UPDATE users SET role = 'self_care' WHERE id = 50`).run();
      console.log('[startup] Fixed McKenzie (user 50) role -> self_care');
    }
  } catch (e) { /* user 50 may not exist in all environments */ }

  // One-time fix: stamp Donielle (user 49) as primaryContactId on client 24
  // Root cause: self_care_to_mc path did not update primaryContactId when MC already had clientId
  try {
    const client24 = sqlite.prepare(`SELECT primary_contact_id FROM clients WHERE id = 24`).get() as any;
    if (client24 && client24.primary_contact_id !== 49) {
      sqlite.prepare(`UPDATE clients SET primary_contact_id = 49 WHERE id = 24`).run();
      console.log("[startup] Fixed primaryContactId on client 24 -> user 49 (Donielle)");
    }
  } catch (e) { /* client 24 may not exist in all environments */ }

  // One-time seed: give +mc2 a second client portal so Care Home can be tested
  // goodstuffpros+mc2@gmail.com is the test MC account
  try {
    const mc2Account = sqlite.prepare(`SELECT user_id FROM auth_accounts WHERE email = 'goodstuffpros+mc2@gmail.com'`).get() as any;
    if (mc2Account) {
      const mc2UserId = mc2Account.user_id;
      // Count existing portals in junction table
      const existingPortals = sqlite.prepare(`SELECT COUNT(*) as cnt FROM user_client_relationships WHERE user_id = ?`).get(mc2UserId) as any;
      if (existingPortals && existingPortals.cnt < 2) {
        // Check if mc2 already has a primary client
        const mc2User = sqlite.prepare(`SELECT client_id FROM users WHERE id = ?`).get(mc2UserId) as any;
        if (mc2User?.client_id) {
          // Ensure primary junction row exists
          const primaryExists = sqlite.prepare(`SELECT id FROM user_client_relationships WHERE user_id = ? AND client_id = ?`).get(mc2UserId, mc2User.client_id) as any;
          if (!primaryExists) {
            sqlite.prepare(`INSERT INTO user_client_relationships (user_id, client_id, role, is_primary, created_at) VALUES (?, ?, 'mc', 1, ?)`)
              .run(mc2UserId, mc2User.client_id, new Date().toISOString());
            console.log(`[startup] +mc2: seeded primary junction row for client ${mc2User.client_id}`);
          }
          // Create the second test client
          const existing2 = sqlite.prepare(`SELECT COUNT(*) as cnt FROM user_client_relationships WHERE user_id = ?`).get(mc2UserId) as any;
          if (existing2.cnt < 2) {
            const now = new Date().toISOString();
            const newClient = sqlite.prepare(
              `INSERT INTO clients (name, caregiver_id, primary_contact_id, color_theme, is_active) VALUES (?, ?, ?, ?, 1)`
            ).run('Test Parent Two', mc2UserId, mc2UserId, 'amber');
            sqlite.prepare(`INSERT INTO user_client_relationships (user_id, client_id, role, is_primary, created_at) VALUES (?, ?, 'mc', 0, ?)`)
              .run(mc2UserId, newClient.lastInsertRowid, now);
            console.log(`[startup] +mc2: created second test client (amber) for Care Home testing`);
          }
        }
      }
    }
  } catch (e) { console.log('[startup] +mc2 seed skipped:', e); }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      // Start automated flag engine (runs every 15 minutes)
      startFlagEngine();
    },
  );
})();
