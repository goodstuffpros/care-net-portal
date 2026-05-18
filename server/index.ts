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
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
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

  // One-time fix: stamp Donielle (user 49) as primaryContactId on client 24
  // Root cause: self_care_to_mc path did not update primaryContactId when MC already had clientId
  try {
    const client24 = sqlite.prepare(`SELECT primary_contact_id FROM clients WHERE id = 24`).get() as any;
    if (client24 && client24.primary_contact_id !== 49) {
      sqlite.prepare(`UPDATE clients SET primary_contact_id = 49 WHERE id = 24`).run();
      console.log("[startup] Fixed primaryContactId on client 24 -> user 49 (Donielle)");
    }
  } catch (e) { /* client 24 may not exist in all environments */ }

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
