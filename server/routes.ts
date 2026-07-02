import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { computeBadgeScore, getBadgeScore } from "./badgeEngine";
import { runPatternEngine, saveTagsForEntry, checkResolvedPatterns, resurfaceDismissedPatterns } from "./patternEngine";
import { db, sqlite } from "./db";
import { badgeSurveys, badgeScores, notifications, careScopes, authAccounts, authSessions, betaApplications, users, clients, helpdeskEscalations, connectionInvites, documents, activityLogs, scheduleEvents, vitals, medications, thoughtEntries, mediaItems, medicationLogs, chatThreads, archiveSummaries, miscNotes, outings, shifts, careFlags, messages, careDirectoryEntries, emergencyAlerts, ideas, healthHistoryEntries, userClientRelationships } from "@shared/schema";
import { buildSystemPrompt } from "./helpdesk-knowledge";
import { eq, and, lt, desc, sql, isNull } from "drizzle-orm";
import path from "path";
import { getOfficeHtml } from "./office";
import fs from "fs";
import {
  hashPassword, verifyPassword, createSession, revokeSession,
  setSessionCookie, clearSessionCookie, getTokenFromRequest,
  verifyJWT, hashToken, generateToken,
  sendEmail, emailApprovalTemplate, emailDenialTemplate,
  emailVerifyTemplate, emailPasswordResetTemplate, emailApprovalWelcomeTemplate,
  requireAuth, requireAuthAccount, requireReAuth, requireAdmin, requirePortalAccess, checkPortalAccess, type AuthRequest
} from "./auth";

export function registerRoutes(httpServer: Server, app: Express) {

  // ══════════════════════════════════════════════════════════════════════════
  // AUTH ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  // POST /api/auth/apply — submit beta application + create account + send verification email
  app.post("/api/auth/apply", async (req: AuthRequest, res) => {
    const { email, name, role, currentlyInCare, intent, agreedToConfidentiality, password, inviteToken: connectionInviteToken } = req.body;
    // self_managed path may omit currentlyInCare/intent — we auto-fill them
    const resolvedCurrentlyInCare = currentlyInCare || (role === "self_managed" ? "yes" : null);
    const resolvedIntent = intent || (role === "self_managed" ? "Self-Managed Care signup" : null);
    if (!email || !name || !role || !resolvedCurrentlyInCare || !resolvedIntent || !agreedToConfidentiality || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const normalizedEmail = email.toLowerCase().trim();

    const existing = db.select().from(betaApplications).where(eq(betaApplications.email, normalizedEmail)).get();
    if (existing) {
      return res.status(409).json({ message: "An application with this email already exists" });
    }
    const existingAccount = db.select().from(authAccounts).where(eq(authAccounts.email, normalizedEmail)).get();
    if (existingAccount) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    // Store application (auto-pending — will auto-approve on email verify)
    // connectionInviteToken: if present, the invite will be auto-accepted after email verify
    db.insert(betaApplications).values({
      email: normalizedEmail,
      name: name.trim(),
      role,
      currentlyInCare: resolvedCurrentlyInCare,
      intent: resolvedIntent.trim(),
      agreedToConfidentiality: !!agreedToConfidentiality,
      status: "pending",
      createdAt: new Date().toISOString(),
      ...(connectionInviteToken ? { inviteToken: connectionInviteToken } : {}),
    }).run();

    // Create auth account immediately (unverified)
    const passwordHash = await hashPassword(password);
    const verifyToken = generateToken(32);
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    db.insert(authAccounts).values({
      email: normalizedEmail,
      passwordHash,
      emailVerified: false,
      emailVerifyToken: verifyToken,
      emailVerifyExpiry: verifyExpiry,
      createdAt: new Date().toISOString(),
    }).run();

    // Send verification email
    const appUrl = process.env.APP_URL || "http://localhost:5000";
    const verifyUrl = `${appUrl}/#/verify-email/${verifyToken}`;
    sendEmail({
      to: normalizedEmail,
      subject: "Verify your Care Net Portal email",
      html: emailVerifyTemplate(name.trim(), verifyUrl),
    }).catch(err => console.error("[apply] verification email failed:", err));

    res.json({ success: true, message: "Check your email to verify your account and get started.", needsVerification: true });
  });

  // POST /api/auth/resend-verification
  app.post("/api/auth/resend-verification", async (req: AuthRequest, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    // Always return 200 to prevent enumeration
    res.json({ success: true, message: "If that email is pending verification, a new link has been sent." });

    const account = db.select().from(authAccounts).where(eq(authAccounts.email, email.toLowerCase())).get();
    if (!account || account.emailVerified) return;

    const verifyToken = generateToken(32);
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.update(authAccounts).set({ emailVerifyToken: verifyToken, emailVerifyExpiry: verifyExpiry })
      .where(eq(authAccounts.id, account.id)).run();

    const app_ = db.select().from(betaApplications).where(eq(betaApplications.email, account.email)).get();
    const appUrl = process.env.APP_URL || "http://localhost:5000";
    const verifyUrl = `${appUrl}/#/verify-email/${verifyToken}`;
    sendEmail({
      to: account.email,
      subject: "Verify your Care Net Portal email",
      html: emailVerifyTemplate(app_?.name || "there", verifyUrl),
    }).catch(err => console.error("[resend-verification] email failed:", err));
  });

  // POST /api/auth/login
  app.post("/api/auth/login", async (req: AuthRequest, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const account = db.select().from(authAccounts).where(eq(authAccounts.email, email.toLowerCase())).get();
    if (!account) return res.status(401).json({ message: "Invalid email or password" });
    if (!account.emailVerified) return res.status(403).json({ message: "Please verify your email first", needsVerification: true });
    if (!account.userId) return res.status(403).json({ message: "Account not yet activated" });

    const valid = await verifyPassword(password, account.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid email or password" });

    // Stamp last login time and increment login count
    sqlite.prepare(`UPDATE auth_accounts SET last_login_at = ?, login_count = COALESCE(login_count, 0) + 1 WHERE id = ?`).run(new Date().toISOString(), account.id);

    const token = await createSession(account.id, req);
    setSessionCookie(res, token); // keep cookie for server-side fallback

    const user = db.select().from(users).where(eq(users.id, account.userId)).get();
    // Also return the token in the body so clients can store it in localStorage
    // and send it as Authorization: Bearer — bypasses cookie propagation issues on Android
    res.json({ success: true, token, user: { id: user!.id, name: user!.name, role: user!.role, email: account.email } });
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", async (req: AuthRequest, res) => {
    const token = getTokenFromRequest(req);
    if (token) {
      const payload = await verifyJWT(token);
      if (payload) revokeSession(payload.jti);
    }
    clearSessionCookie(res);
    res.json({ success: true });
  });

  // GET /api/auth/me — returns current user if authenticated
  app.get("/api/auth/me", async (req: AuthRequest, res) => {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ message: "Not authenticated" });
    const payload = await verifyJWT(token);
    if (!payload) return res.status(401).json({ message: "Session expired" });
    const account = db.select().from(authAccounts).where(eq(authAccounts.id, payload.authAccountId)).get();
    if (!account) return res.status(401).json({ message: "Not authenticated" });
    // No userId yet — try to self-heal by finding a users row with matching email
    if (!account.userId) {
      const userByEmail = db.select().from(users).where(eq(users.email, account.email)).get();
      if (userByEmail) {
        db.update(authAccounts).set({ userId: userByEmail.id }).where(eq(authAccounts.id, account.id)).run();
        account.userId = userByEmail.id;
      }
    }
    // Still no userId — account exists but profile not created (fresh signup, needs onboarding)
    if (!account.userId) return res.json({ email: account.email, onboardingCompletedAt: null, needsProfile: true });
    let user = db.select().from(users).where(eq(users.id, account.userId)).get();
    if (!user) return res.status(401).json({ message: "User not found" });

    // Self-heal: if the beta application says family/MC but the user row has a caregiver role,
    // correct it now. This fixes accounts created before the onboarding role-skip fix.
    if (user.role === "caregiver" || user.role === "temp_caregiver") {
      const app_ = db.select().from(betaApplications).where(eq(betaApplications.email, account.email)).get();
      if (app_ && (app_.role === "family" || app_.role === "both" && user.role !== "caregiver")) {
        // Application said family — correct the user role
        const correctRole = app_.role === "family" ? "primary_family" : user.role;
        if (correctRole !== user.role) {
          db.update(users).set({ role: correctRole }).where(eq(users.id, user.id)).run();
          user = { ...user, role: correctRole };
        }
      }
    }

    const acctExtras = sqlite.prepare(`SELECT login_count FROM auth_accounts WHERE id = ?`).get(account.id) as any;
    const userExtras = sqlite.prepare(`SELECT has_seen_high_five, has_seen_open_hand FROM users WHERE id = ?`).get(user.id) as any;
    res.json({ id: user.id, name: user.name, role: user.role, email: account.email, onboardingCompletedAt: user.onboardingCompletedAt, mcSetupCompletedAt: user.mcSetupCompletedAt, carePathChoice: user.carePathChoice, clientId: user.clientId, sampleClientId: user.sampleClientId ?? null, permissionLevel: user.permissionLevel ?? null, contributorWelcomeSeen: user.contributorWelcomeSeen ?? false, phone: user.phone, avatarInitials: user.avatarInitials, multiPortalNudgeSnoozedUntil: user.multiPortalNudgeSnoozedUntil ?? null, elevatedUntil: user.elevatedUntil ?? null, hasSeenMcInvitePrompt: user.hasSeenMcInvitePrompt ?? false, loginCount: acctExtras?.login_count ?? 0, hasSeenHighFive: userExtras?.has_seen_high_five ?? false, hasSeenOpenHand: userExtras?.has_seen_open_hand ?? false });
  });

  // POST /api/auth/complete-signup — called with invite token to set password
  app.post("/api/auth/complete-signup", async (req: AuthRequest, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "Token and password required" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const app_ = db.select().from(betaApplications).where(eq(betaApplications.inviteToken, token)).get();
    if (!app_ || app_.status !== "approved") return res.status(400).json({ message: "Invalid or expired invite link" });
    if (app_.inviteExpiry && new Date(app_.inviteExpiry) < new Date()) {
      return res.status(400).json({ message: "This invite link has expired. Please contact us for a new one." });
    }
    if (app_.accountCreatedAt) return res.status(400).json({ message: "Account already created" });

    const passwordHash = await hashPassword(password);

    // Invite-based signup: email already verified (they clicked link from their inbox)
    const newAccount = db.insert(authAccounts).values({
      email: app_.email,
      passwordHash,
      emailVerified: true,
      createdAt: new Date().toISOString(),
    }).returning().get();

    // Mark application as account created
    db.update(betaApplications)
      .set({ accountCreatedAt: new Date().toISOString() })
      .where(eq(betaApplications.id, app_.id))
      .run();

    // Create session so they land in the app ready for onboarding
    const sessionToken = await createSession(newAccount.id, req);
    setSessionCookie(res, sessionToken);

    res.json({ success: true, message: "Account created." });
  });

  // POST /api/auth/verify-email
  app.post("/api/auth/verify-email", async (req: AuthRequest, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token required" });

    const account = db.select().from(authAccounts).where(eq(authAccounts.emailVerifyToken, token)).get();
    if (!account) return res.status(400).json({ message: "Invalid verification link" });
    if (account.emailVerifyExpiry && new Date(account.emailVerifyExpiry) < new Date()) {
      return res.status(400).json({ message: "Verification link expired" });
    }

    // Find matching beta application to get the role/name
    const app_ = db.select().from(betaApplications).where(eq(betaApplications.email, account.email)).get();
    if (!app_) return res.status(400).json({ message: "Application not found" });

    // Map application role to portal role
    const isSelfManagedApp = app_.role === "self_managed";
    const portalRole = app_.role === "caregiver" ? "caregiver"
      : app_.role === "family" ? "primary_family"
      : app_.role === "both" ? "caregiver"
      : isSelfManagedApp ? "self_care"
      : "primary_family";

    // Create portal user
    const newUser = db.insert(users).values({
      name: app_.name,
      role: portalRole,
      email: account.email,
      avatarInitials: app_.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2),
      isActive: true,
    }).returning().get();

    // Self-managed signup: create client record, set self_care_mc, mark onboarding done
    if (isSelfManagedApp) {
      storage.createSelfCareClient(newUser.id, app_.name, null, null);
      db.update(users).set({ onboardingCompletedAt: new Date().toISOString() })
        .where(eq(users.id, newUser.id)).run();
    }

    // Link account to user
    db.update(authAccounts).set({
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpiry: null,
      userId: newUser.id,
    }).where(eq(authAccounts.id, account.id)).run();

    // Auto-approve the beta application
    db.update(betaApplications).set({
      status: "approved",
      approvedAt: new Date().toISOString(),
      accountCreatedAt: new Date().toISOString(),
    }).where(eq(betaApplications.email, account.email)).run();

    // Send welcome/approval email non-blocking
    const appUrl = process.env.APP_URL || "http://localhost:5000";
    const loginUrl = `${appUrl}/#/login`;
    sendEmail({
      to: account.email,
      subject: "You're in — Care Net Portal Beta",
      html: emailApprovalWelcomeTemplate(app_.name, loginUrl),
    }).catch(err => console.error("[auto-approve] email failed:", err?.message));

    // Auto-accept connection invite if one was stored on the application
    if (app_.inviteToken) {
      try {
        const connInvite = db.select().from(connectionInvites).where(eq(connectionInvites.token, app_.inviteToken)).get();
        if (connInvite && connInvite.status === "pending" && new Date(connInvite.expiresAt) >= new Date()) {
          const now2 = new Date().toISOString();
          // Assign clientId + role from invite
          let clientId2 = connInvite.clientId ?? null;
          if (connInvite.inviteType === "mc_to_family") {
            if (clientId2) {
              db.update(users).set({ clientId: clientId2, role: "secondary_family" }).where(eq(users.id, newUser.id)).run();
              // Also write a userClientRelationships row so Care Home multi-portal works
              const existingRel2 = db.select().from(userClientRelationships)
                .where(and(eq(userClientRelationships.userId, newUser.id), eq(userClientRelationships.clientId, clientId2))).get();
              if (!existingRel2) {
                const relCount2 = db.select().from(userClientRelationships).where(eq(userClientRelationships.userId, newUser.id)).all().length;
                db.insert(userClientRelationships).values({
                  userId: newUser.id, clientId: clientId2, role: "secondary_family",
                  isPrimary: relCount2 === 0, createdAt: new Date().toISOString(),
                }).run();
              }
            }
          } else if (connInvite.inviteType === "mc_to_caregiver") {
            if (clientId2) {
              db.update(users).set({ clientId: clientId2 }).where(eq(users.id, newUser.id)).run();
              // Seed junction row so CG appears correctly in Care Team view
              const existingRelV = db.select().from(userClientRelationships)
                .where(and(eq(userClientRelationships.userId, newUser.id), eq(userClientRelationships.clientId, clientId2))).get();
              if (!existingRelV) {
                const relCountV = db.select().from(userClientRelationships).where(eq(userClientRelationships.userId, newUser.id)).all().length;
                db.insert(userClientRelationships).values({
                  userId: newUser.id, clientId: clientId2, role: 'caregiver',
                  isPrimary: relCountV === 0, createdAt: new Date().toISOString(),
                }).run();
              }
            }
          } else if (connInvite.inviteType === "caregiver_to_mc") {
            // The CG sender may have a practice client or no client yet.
            // Do NOT assign the MC to a practice client — the real clientId comes
            // from mc/setup when the MC creates their loved one's profile.
            // We only set role here; the clientId link is resolved at mc/setup.
            if (connInvite.senderUserId) {
              const sender2 = db.select().from(users).where(eq(users.id, connInvite.senderUserId)).get();
              clientId2 = sender2?.clientId ?? null;
              // If CG's current clientId is a practice client, defer — don't assign MC to it
              if (clientId2) {
                const cgClient2 = db.select().from(clients).where(eq(clients.id, clientId2)).get();
                if (cgClient2?.isPractice) clientId2 = null;
              }
            }
            // Always set role; only set clientId if we resolved a real one
            db.update(users).set({ role: "primary_family", ...(clientId2 ? { clientId: clientId2 } : {}) }).where(eq(users.id, newUser.id)).run();
            // Seed junction row if we have a real clientId
            if (clientId2) {
              const existingRelMV = db.select().from(userClientRelationships)
                .where(and(eq(userClientRelationships.userId, newUser.id), eq(userClientRelationships.clientId, clientId2))).get();
              if (!existingRelMV) {
                const relCountMV = db.select().from(userClientRelationships).where(eq(userClientRelationships.userId, newUser.id)).all().length;
                db.insert(userClientRelationships).values({
                  userId: newUser.id, clientId: clientId2, role: 'mc',
                  isPrimary: relCountMV === 0, createdAt: new Date().toISOString(),
                }).run();
              }
            }
          }
          db.update(connectionInvites).set({ status: "accepted", acceptedByUserId: newUser.id, acceptedAt: now2 })
            .where(eq(connectionInvites.token, app_.inviteToken)).run();
          // Notify the sender
          if (connInvite.senderUserId) {
            const senderAcc = db.select().from(authAccounts).where(eq(authAccounts.userId, connInvite.senderUserId)).get();
            if (senderAcc?.email) {
              sendEmail({
                to: senderAcc.email,
                subject: `${newUser.name} accepted your Care Net Portal invitation`,
                html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;"><p style="font-size:16px;"><strong>${newUser.name}</strong> just accepted your invitation and joined Care Net Portal.</p><p style="color:#666;">Your portals are now connected.</p></div>`,
              }).catch(() => {});
            }
          }
        }
      } catch (e) { console.error("[verify] auto-accept invite failed:", e); }
    }

    // Auto-login
    const sessionToken = await createSession(account.id, req);
    setSessionCookie(res, sessionToken);

    res.json({ success: true, user: { id: newUser.id, name: newUser.name, role: newUser.role } });
  });

  // POST /api/auth/forgot-password
  app.post("/api/auth/forgot-password", async (req: AuthRequest, res) => {
    const { email } = req.body;
    // Always return success to prevent email enumeration
    res.json({ success: true, message: "If that email is registered, you'll receive a reset link shortly." });

    const account = db.select().from(authAccounts).where(eq(authAccounts.email, email?.toLowerCase())).get();
    if (!account) return;

    const resetToken = generateToken(32);
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    db.update(authAccounts).set({ passwordResetToken: resetToken, passwordResetExpiry: resetExpiry })
      .where(eq(authAccounts.id, account.id)).run();

    const app_ = db.select().from(betaApplications).where(eq(betaApplications.email, account.email)).get();
    const appUrl = process.env.APP_URL || "http://localhost:5000";
    const resetUrl = `${appUrl}/?page=reset-password&token=${resetToken}`;
    await sendEmail({
      to: account.email,
      subject: "Reset your Care Net Portal password",
      html: emailPasswordResetTemplate(app_?.name || "there", resetUrl),
    });
  });

  // POST /api/auth/reset-password
  app.post("/api/auth/reset-password", async (req: AuthRequest, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "Token and password required" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const account = db.select().from(authAccounts).where(eq(authAccounts.passwordResetToken, token)).get();
    if (!account) return res.status(400).json({ message: "Invalid or expired reset link" });
    if (account.passwordResetExpiry && new Date(account.passwordResetExpiry) < new Date()) {
      return res.status(400).json({ message: "Reset link expired. Please request a new one." });
    }

    const passwordHash = await hashPassword(password);
    db.update(authAccounts).set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
    }).where(eq(authAccounts.id, account.id)).run();

    // Revoke all existing sessions
    db.update(authSessions)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(authSessions.authAccountId, account.id))
      .run();

    res.json({ success: true, message: "Password updated. Please log in with your new password." });
  });

  // ── Admin: Beta Application Management ──────────────────────────────────

  // GET /api/admin/whoami — diagnostic: returns the authenticated user ID, email, and admin status
  // No requireAdmin — this is used to debug auth failures from the admin panel
  app.get("/api/admin/whoami", requireAuth, (req: AuthRequest, res) => {
    const ADMIN_USER_IDS = new Set([10, 11, 12, 43]);
    const account = req.authAccountId
      ? db.select().from(authAccounts).where(eq(authAccounts.id, req.authAccountId)).get()
      : null;
    res.json({
      authAccountId: req.authAccountId ?? null,
      authUserId: req.authUserId ?? null,
      authUserRole: req.authUserRole ?? null,
      email: account?.email ?? null,
      isAdmin: req.authUserId ? ADMIN_USER_IDS.has(req.authUserId) : false,
    });
  });

  // GET /api/admin/applications — list all beta applications with email verified status
  app.get("/api/admin/applications", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const apps = db.select().from(betaApplications).all();
    // Attach emailVerified from authAccounts
    const enriched = apps.map(app => {
      const account = db.select().from(authAccounts).where(eq(authAccounts.email, app.email)).get();
      return { ...app, emailVerified: account?.emailVerified ?? false };
    });
    res.json(enriched);
  });

  // POST /api/admin/applications/:id/approve
  app.post("/api/admin/applications/:id/approve", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const app_ = db.select().from(betaApplications).where(eq(betaApplications.id, id)).get();
      if (!app_) return res.status(404).json({ message: "Application not found" });

      const inviteToken = generateToken(32);
      const inviteExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const appUrl = process.env.APP_URL || "http://localhost:5000";
      const inviteUrl = `${appUrl}/?page=complete-signup&token=${inviteToken}`;

      // Use raw SQL — reviewed_at, invite_token etc. may not exist in older live DBs
      try {
        sqlite.prepare(`UPDATE beta_applications SET status = 'approved', reviewed_at = ?, invite_token = ?, invite_expiry = ?, invite_sent_at = ? WHERE id = ?`)
          .run(new Date().toISOString(), inviteToken, inviteExpiry, new Date().toISOString(), id);
      } catch {
        sqlite.prepare(`UPDATE beta_applications SET status = 'approved' WHERE id = ?`).run(id);
      }

      // Send email non-blocking — DB update already committed
      sendEmail({
        to: app_.email,
        subject: "You're in — Care Net Portal Beta",
        html: emailApprovalTemplate(app_.name, inviteUrl),
      }).catch((err) => console.error("[approve] email send failed:", err?.message));

      res.json({ success: true, message: `Approved and invite sent to ${app_.email}` });
    } catch (err: any) {
      console.error("[approve] failed:", err?.message);
      res.status(500).json({ message: err?.message || "Approve failed" });
    }
  });

  // POST /api/admin/applications/:id/deny
  app.post("/api/admin/applications/:id/deny", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const app_ = db.select().from(betaApplications).where(eq(betaApplications.id, id)).get();
      if (!app_) return res.status(404).json({ message: "Application not found" });

      // Use raw SQL to update only columns guaranteed to exist in the live DB.
      // reviewed_at and review_note may be missing in older DBs — update via try/catch.
      try {
        sqlite.prepare(`UPDATE beta_applications SET status = 'denied', reviewed_at = ?, review_note = ? WHERE id = ?`)
          .run(new Date().toISOString(), req.body.note || null, id);
      } catch {
        // Fallback: just flip the status if the other columns don't exist yet
        sqlite.prepare(`UPDATE beta_applications SET status = 'denied' WHERE id = ?`).run(id);
      }

      // Send email non-blocking — DB update already committed
      sendEmail({
        to: app_.email,
        subject: "Care Net Portal — Application Update",
        html: emailDenialTemplate(app_.name),
      }).catch((err) => console.error("[deny] email send failed:", err?.message));

      res.json({ success: true });
    } catch (err: any) {
      console.error("[deny] failed:", err?.message);
      res.status(500).json({ message: err?.message || "Deny failed" });
    }
  });



  // POST /api/admin/users/:id/link-portal — manually link a user to a clientId (fixes disconnected signups)
  app.post("/api/admin/users/:id/link-portal", requireAuth, requireAdmin, (req: AuthRequest, res) => {
    const userId = parseInt(req.params.id);
    const { clientId } = req.body;
    if (!userId || !clientId) return res.status(400).json({ message: "userId and clientId required" });
    try {
      const user = db.select().from(users).where(eq(users.id, userId)).get();
      if (!user) return res.status(404).json({ message: "User not found" });
      db.update(users).set({ clientId: Number(clientId) }).where(eq(users.id, userId)).run();
      console.log(`[admin] Linked user ${userId} (${user.name}) to clientId ${clientId}`);
      res.json({ success: true, userId, clientId: Number(clientId) });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });


  // POST /api/admin/users/deactivate — deactivate a user account by email (admin only)
  app.post("/api/admin/users/deactivate", requireAuth, requireAdmin, (req: AuthRequest, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email required" });
    const user = db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
    if (!user) return res.status(404).json({ message: "Account not found" });
    db.update(users).set({ isActive: false }).where(eq(users.id, user.id)).run();
    res.json({ success: true, message: `${email} deactivated` });
  });

  // POST /api/admin/users/:id/role — change a user's role (admin only)
  // Body: { role, clientId? }
  // Side effects handled here:
  //   1. userClientRelationships.role updated to match new role
  //   2. clients.primaryContactId updated when new role is primary_family
  //   3. permissionLevel set to self_care_mc when new role is self_care
  //   4. permissionLevel cleared when leaving self_care
  //   5. Junction row inserted if missing and clientId is known
  app.post("/api/admin/users/:id/role", requireAuth, requireAdmin, (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const { role, clientId: bodyClientId } = req.body;
      const valid = ["caregiver","primary_family","secondary_family","self_care","facilitator"];
      if (!valid.includes(role)) return res.status(400).json({ message: "Invalid role" });

      // Read current user state before making changes
      const currentUser = db.select().from(users).where(eq(users.id, id)).get();
      if (!currentUser) return res.status(404).json({ message: "User not found" });

      const prevRole = currentUser.role;
      const clientId = bodyClientId ?? currentUser.clientId;

      // Map user role → junction row role
      const junctionRoleMap: Record<string, string> = {
        primary_family: "mc",
        caregiver: "caregiver",
        secondary_family: "secondary_family",
        self_care: "self_care",
        facilitator: "caregiver", // facilitator treated as CG in junction
      };
      const junctionRole = junctionRoleMap[role] ?? role;

      // 1. Update user role (and permissionLevel side effect)
      const userUpdate: Record<string, any> = { role };
      if (role === "self_care" && prevRole !== "self_care") {
        userUpdate.permissionLevel = "self_care_mc";
      } else if (prevRole === "self_care" && role !== "self_care") {
        userUpdate.permissionLevel = null;
      }
      db.update(users).set(userUpdate).where(eq(users.id, id)).run();

      const log: string[] = [`role updated: ${prevRole} → ${role}`];

      // 2. Update or insert junction row
      if (clientId) {
        const existingRel = db.select().from(userClientRelationships)
          .where(and(eq(userClientRelationships.userId, id), eq(userClientRelationships.clientId, clientId))).get();
        if (existingRel) {
          db.update(userClientRelationships).set({ role: junctionRole })
            .where(and(eq(userClientRelationships.userId, id), eq(userClientRelationships.clientId, clientId))).run();
          log.push(`junction row updated: role → ${junctionRole}`);
        } else {
          // Insert a junction row — this user had none (edge case: admin set clientId but no row existed)
          const relCount = db.select().from(userClientRelationships).where(eq(userClientRelationships.userId, id)).all().length;
          db.insert(userClientRelationships).values({
            userId: id,
            clientId,
            role: junctionRole,
            isPrimary: relCount === 0,
            createdAt: new Date().toISOString(),
          }).run();
          log.push(`junction row inserted: role=${junctionRole}, clientId=${clientId}`);
        }

        // 3. If new role is MC, update clients.primaryContactId
        if (role === "primary_family") {
          db.update(clients).set({ primaryContactId: id }).where(eq(clients.id, clientId)).run();
          log.push(`clients.primaryContactId set to user ${id}`);
        }

        // 4. If previous role was MC and new role is not, clear primaryContactId only if
        //    this user was actually the primaryContactId (avoid clearing someone else's)
        if (prevRole === "primary_family" && role !== "primary_family") {
          const clientRecord = db.select().from(clients).where(eq(clients.id, clientId)).get();
          if (clientRecord?.primaryContactId === id) {
            db.update(clients).set({ primaryContactId: null }).where(eq(clients.id, clientId)).run();
            log.push(`clients.primaryContactId cleared (user was previous MC)`);
          }
        }
      }

      res.json({ success: true, role, log });
    } catch(e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/admin/repair/portal-membership — one-time repair endpoint
  // Fixes a user's portal membership: sets primaryContactId on a client, ensures
  // userClientRelationships row exists, and clears stale MC wizard fields.
  app.post("/api/admin/repair/portal-membership", requireAuth, requireAdmin, (req: AuthRequest, res) => {
    try {
      const { clientId, primaryContactEmail, cgUserId, clearMcFieldsForUserId } = req.body;
      const results: string[] = [];

      // 1. Set primaryContactId on the client
      if (clientId && primaryContactEmail) {
        const pcAccount = db.select().from(authAccounts)
          .where(eq(authAccounts.email, primaryContactEmail.toLowerCase())).get();
        if (pcAccount?.userId) {
          db.update(clients).set({ primaryContactId: pcAccount.userId })
            .where(eq(clients.id, clientId)).run();
          results.push(`primaryContactId on client ${clientId} set to user ${pcAccount.userId} (${primaryContactEmail})`);
        } else {
          results.push(`WARN: could not find user for ${primaryContactEmail}`);
        }
      }

      // 2. Ensure CG has a userClientRelationships row
      if (clientId && cgUserId) {
        const existing = db.select().from(userClientRelationships)
          .where(and(eq(userClientRelationships.userId, cgUserId), eq(userClientRelationships.clientId, clientId))).get();
        if (!existing) {
          db.insert(userClientRelationships).values({
            userId: cgUserId,
            clientId,
            role: 'caregiver',
            isPrimary: true,
            createdAt: new Date().toISOString(),
          }).run();
          results.push(`Junction row created: user ${cgUserId} as caregiver on client ${clientId}`);
        } else {
          // Update role to caregiver in case it was wrongly set to mc
          db.update(userClientRelationships)
            .set({ role: 'caregiver' })
            .where(and(eq(userClientRelationships.userId, cgUserId), eq(userClientRelationships.clientId, clientId))).run();
          results.push(`Junction row updated: user ${cgUserId} role set to caregiver on client ${clientId}`);
        }
      }

      // 3. Clear stale MC wizard fields from a user who accidentally went through it
      if (clearMcFieldsForUserId) {
        db.update(users).set({
          mcSetupCompletedAt: null,
          carePathChoice: null,
        }).where(eq(users.id, clearMcFieldsForUserId)).run();
        results.push(`Cleared mcSetupCompletedAt and carePathChoice for user ${clearMcFieldsForUserId}`);
      }

      // 4. Revoke all active sessions for a user (forces fresh login)
      if (req.body.revokeSessionsForUserId) {
        const uid = req.body.revokeSessionsForUserId;
        const account = db.select().from(authAccounts).where(eq(authAccounts.userId, uid)).get();
        if (account) {
          const now2 = new Date().toISOString();
          sqlite.prepare(
            `UPDATE auth_sessions SET revoked_at = ? WHERE auth_account_id = ? AND revoked_at IS NULL`
          ).run(now2, account.id);
          results.push(`Revoked all active sessions for user ${uid} (authAccountId ${account.id})`);
        } else {
          results.push(`WARN: no auth account found for user ${uid}`);
        }
      }

      // 5. Stamp onboardingCompletedAt and mcSetupCompletedAt for a CG to skip all wizards
      if (req.body.stampOnboardingForUserId) {
        const uid = req.body.stampOnboardingForUserId;
        const now2 = new Date().toISOString();
        db.update(users).set({
          onboardingCompletedAt: now2,
          mcSetupCompletedAt: now2,
        }).where(eq(users.id, uid)).run();
        results.push(`Stamped onboardingCompletedAt + mcSetupCompletedAt for user ${uid}`);
      }

      res.json({ success: true, results });
    } catch(e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Onboarding ─────────────────────────────────────────────────────────────

  // POST /api/onboarding/profile — save profile data + create user row for real auth users
  // Uses requireAuthAccount (not requireAuth) because userId is null until this route runs
  app.post("/api/onboarding/profile", requireAuthAccount, async (req: AuthRequest, res) => {
    const { name, phone, role, city, state } = req.body;
    if (!name || !role) return res.status(400).json({ message: "Name and role are required" });

    try {
      const account = db.select().from(authAccounts).where(eq(authAccounts.id, req.authAccountId!)).get();
      if (!account) return res.status(401).json({ message: "Not authenticated" });

      const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

      if (account.userId) {
        // Update existing user row
        db.update(users).set({
          name,
          phone: phone || null,
          role,
          avatarInitials: initials,
        }).where(eq(users.id, account.userId)).run();
        res.json({ success: true, userId: account.userId });
      } else {
        // Create new user row (first-time onboarding)
        const newUser = db.insert(users).values({
          name,
          role,
          email: account.email,
          phone: phone || null,
          avatarInitials: initials,
          isActive: true,
          notificationPrefs: '{"all":true}',
        }).returning().get();
        // Link auth_account → users row
        db.update(authAccounts).set({ userId: newUser.id }).where(eq(authAccounts.id, account.id)).run();
        res.json({ success: true, userId: newUser.id });
      }
    } catch (err: any) {
      console.error("[onboarding/profile] ERROR:", err?.message || err);
      res.status(500).json({ message: err?.message || "Failed to save profile" });
    }
  });

  // POST /api/onboarding/complete — mark onboarding as done
  app.post("/api/onboarding/complete", requireAuthAccount, async (req: AuthRequest, res) => {
    const account = db.select().from(authAccounts).where(eq(authAccounts.id, req.authAccountId!)).get();
    if (!account?.userId) return res.status(401).json({ message: "Not authenticated" });
    db.update(users).set({ onboardingCompletedAt: new Date().toISOString() }).where(eq(users.id, account.userId)).run();

    // If this user is a CG who arrived via an mc_to_caregiver invite, the connection
    // already happened at verify-email. Return the client name so the done screen
    // can show "You're already connected to [Name]'s portal" instead of the generic
    // "wait for an MC to invite you" message.
    let connectedClient: { clientName: string } | null = null;
    try {
      const cgUser = db.select().from(users).where(eq(users.id, account.userId)).get();
      if (cgUser?.role === "caregiver" && cgUser.clientId) {
        const invite = db.select().from(connectionInvites)
          .where(
            and(
              eq(connectionInvites.acceptedByUserId, cgUser.id),
              eq(connectionInvites.inviteType, "mc_to_caregiver"),
              eq(connectionInvites.status, "accepted")
            )
          ).get();
        if (invite) {
          const client = db.select().from(clients).where(eq(clients.id, cgUser.clientId)).get();
          if (client && !client.isPractice) {
            connectedClient = { clientName: client.name };
          }
        }
      }
    } catch (e) { /* non-fatal */ }

    res.json({ success: true, ...(connectedClient ? { connectedClient } : {}) });
  });

  // POST /api/onboarding/self-care-setup — Self-Managed Care path
  // After profile is saved, user creates their own client record and optionally invites MC.
  // Creates client, sets role: self_care, permissionLevel: self_care_mc, links clientUserId.
  app.post("/api/onboarding/self-care-setup", requireAuthAccount, async (req: AuthRequest, res) => {
    const { clientName, clientDob, clientCondition, inviteMcEmail } = req.body;
    if (!clientName) return res.status(400).json({ message: "Your name is required for the client record" });

    try {
      const account = db.select().from(authAccounts).where(eq(authAccounts.id, req.authAccountId!)).get();
      if (!account?.userId) return res.status(401).json({ message: "Not authenticated" });

      const user = db.select().from(users).where(eq(users.id, account.userId)).get();
      if (!user) return res.status(401).json({ message: "User not found" });

      // Create the client record, self-linking this user as both caregiver and clientUser
      const newClient = storage.createSelfCareClient(
        user.id,
        clientName.trim(),
        clientDob || null,
        clientCondition || null,
      );

      // Mark onboarding complete
      db.update(users).set({ onboardingCompletedAt: new Date().toISOString() })
        .where(eq(users.id, user.id)).run();

      let mcInviteToken: string | null = null;

      // Optionally create an MC invite right away
      if (inviteMcEmail && inviteMcEmail.trim()) {
        const token = generateToken(32);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const now = new Date().toISOString();
        db.insert(connectionInvites).values({
          token,
          senderUserId: user.id,
          senderRole: user.role,
          clientId: newClient.id,
          clientName: newClient.name,
          senderName: user.name || account.email || "Care Net Portal",
          invitedEmail: inviteMcEmail.trim(),
          inviteType: "self_care_to_mc",
          status: "pending",
          expiresAt,
          createdAt: now,
        }).run();
        mcInviteToken = token;

        const appUrl = process.env.APP_URL || "https://care-net-portal-production.up.railway.app";
        const inviteUrl = `${appUrl}/#/invite/${token}`;
        await sendEmail({
          to: inviteMcEmail.trim(),
          subject: `${user.name || "Someone"} invited you to be their Main Contact on Care Net Portal`,
          html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #28251D;">
              <div style="background: #01696F; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 22px;">Care Net Portal</h1>
                <p style="margin: 8px 0 0; opacity: 0.85;">You've been invited</p>
              </div>
              <div style="background: #F7F6F2; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #D4D1CA;">
                <p style="font-size: 16px;"><strong>${user.name || "Someone you know"}</strong> has invited you to be their <strong>Main Contact</strong> on Care Net Portal.</p>
                <p style="color: #5A5957; font-size: 14px;">As their Main Contact, you’ll have visibility into their care record and can support them from the background. They remain in full control of their portal.</p>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="${inviteUrl}" style="background: #01696F; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">Accept Invitation</a>
                </div>
                <p style="color: #BAB9B4; font-size: 12px; text-align: center;">This invitation expires in 7 days.</p>
              </div>
            </div>
          `,
        }).catch(err => console.error("[self-care-setup] invite email failed:", err));
      }

      res.json({ success: true, clientId: newClient.id, mcInviteToken });
    } catch (err: any) {
      console.error("[onboarding/self-care-setup] ERROR:", err?.message || err);
      res.status(500).json({ message: err?.message || "Setup failed" });
    }
  });

  // POST /api/mc/setup — MC wizard completion
  // Creates the client (loved one) row, saves care path choice, marks setup done
  app.post("/api/mc/setup", requireAuthAccount, async (req: AuthRequest, res) => {
    const {
      clientName, clientDob, clientCondition, clientNotes, clientRelationship,
      carePathChoice, // 'has_caregiver' | 'self_managing'
    } = req.body;

    if (!clientName) return res.status(400).json({ message: "Loved one's name is required" });

    try {
      const account = db.select().from(authAccounts).where(eq(authAccounts.id, req.authAccountId!)).get();
      if (!account?.userId) return res.status(401).json({ message: "Not authenticated" });

      const mcUser = db.select().from(users).where(eq(users.id, account.userId)).get();
      if (!mcUser) return res.status(401).json({ message: "User not found" });

      let clientIdToUse: number;

      // If MC already has a clientId (arrived via self_care_to_mc invite), skip client creation
      if (mcUser.clientId) {
        clientIdToUse = mcUser.clientId;
        // Mark setup complete and ensure this MC is set as the primaryContactId
        db.update(users).set({
          carePathChoice: carePathChoice || "self_managing",
          mcSetupCompletedAt: new Date().toISOString(),
        }).where(eq(users.id, mcUser.id)).run();
        // Stamp MC as primary contact on the existing client record
        db.update(clients).set({ primaryContactId: mcUser.id }).where(eq(clients.id, mcUser.clientId)).run();
      } else {
        // Create the client (loved one) row
        const validThemes = ['teal', 'sage', 'slate', 'rose', 'amber'];
        const safeTheme = validThemes.includes(req.body.colorTheme) ? req.body.colorTheme : 'teal';
        const newClient = db.insert(clients).values({
          name: clientName,
          dateOfBirth: clientDob || null,
          primaryCondition: clientCondition || null,
          notes: clientNotes || null,
          caregiverId: mcUser.id, // MC is temporary "caregiver" until real CG connects
          primaryContactId: mcUser.id,
          isActive: true,
          appMode: "caregiver",
          colorTheme: safeTheme,
        }).returning().get();
        clientIdToUse = newClient.id;

        // Link MC user to client + save care path
        db.update(users).set({
          clientId: newClient.id,
          carePathChoice: carePathChoice || "self_managing",
          mcSetupCompletedAt: new Date().toISOString(),
        }).where(eq(users.id, mcUser.id)).run();
      }

      // ── CG Token Follow-Through ──────────────────────────────────────────────
      // If this MC arrived via a caregiver_to_mc invite, the invite was auto-accepted
      // at email verify time. The CG's clientId was intentionally not resolved then
      // (may have been null or a practice client). Now that the real client exists,
      // link the CG automatically — they sent the invite, the relationship is established.
      // Return cgLinked so the frontend can show a welcome confirmation on the care-team step.
      let cgLinked: { cgName: string; cgId: number } | null = null;
      try {
        const cgInvite = db.select().from(connectionInvites)
          .where(
            and(
              eq(connectionInvites.acceptedByUserId, mcUser.id),
              eq(connectionInvites.inviteType, "caregiver_to_mc"),
              eq(connectionInvites.status, "accepted")
            )
          ).get();
        if (cgInvite?.senderUserId) {
          const cgUser = db.select().from(users).where(eq(users.id, cgInvite.senderUserId)).get();
          if (cgUser) {
            db.update(users).set({ clientId: clientIdToUse }).where(eq(users.id, cgUser.id)).run();
            db.update(clients).set({ caregiverId: cgUser.id }).where(eq(clients.id, clientIdToUse)).run();
            cgLinked = { cgName: cgUser.name, cgId: cgUser.id };
            console.log(`[mc/setup] CG follow-through: linked CG ${cgUser.id} (${cgUser.name}) to client ${clientIdToUse}`);
          }
        }
      } catch (cgErr: any) {
        console.error("[mc/setup] CG follow-through error (non-fatal):", cgErr?.message);
      }

      // ── Seed junction table for this MC ───────────────────────────────
      try {
        const existingRel = db.select().from(userClientRelationships)
          .where(and(eq(userClientRelationships.userId, mcUser.id), eq(userClientRelationships.clientId, clientIdToUse))).get();
        if (!existingRel) {
          // Count existing relationships to determine isPrimary
          const existingCount = db.select().from(userClientRelationships)
            .where(eq(userClientRelationships.userId, mcUser.id)).all().length;
          db.insert(userClientRelationships).values({
            userId: mcUser.id,
            clientId: clientIdToUse,
            role: 'mc',
            isPrimary: existingCount === 0, // first portal is primary
            createdAt: new Date().toISOString(),
          }).run();
        }
        // Also seed CG into junction table if linked
        if (cgLinked) {
          const cgExisting = db.select().from(userClientRelationships)
            .where(and(eq(userClientRelationships.userId, cgLinked.cgId), eq(userClientRelationships.clientId, clientIdToUse))).get();
          if (!cgExisting) {
            db.insert(userClientRelationships).values({
              userId: cgLinked.cgId,
              clientId: clientIdToUse,
              role: 'caregiver',
              isPrimary: true,
              createdAt: new Date().toISOString(),
            }).run();
          }
        }
      } catch (jErr: any) {
        console.warn('[mc/setup] Junction seed error (non-fatal):', jErr?.message);
      }

      res.json({ success: true, clientId: clientIdToUse, ...(cgLinked ? { cgLinked } : {}) });
    } catch (err: any) {
      console.error("[mc/setup] ERROR:", err?.message || err);
      res.status(500).json({ message: err?.message || "Setup failed" });
    }
  });

  // ── Connection Invites ──────────────────────────────────────────────────────

  // POST /api/invite/create — authenticated user creates an invite link
  // Uses requireAuthAccount (not requireAuth) so users in partial-link state can still invite
  app.post("/api/invite/create", requireAuthAccount, async (req: AuthRequest, res) => {
    try {
      const account = db.select().from(authAccounts).where(eq(authAccounts.id, req.authAccountId!)).get();
      if (!account) return res.status(401).json({ message: "Not authenticated" });
      // If userId not linked yet, try to find user by email and self-heal the link
      let userId = account.userId;
      if (!userId) {
        const userByEmail = db.select().from(users).where(eq(users.email, account.email)).get();
        if (userByEmail) {
          db.update(authAccounts).set({ userId: userByEmail.id }).where(eq(authAccounts.id, account.id)).run();
          userId = userByEmail.id;
        }
      }
      if (!userId) return res.status(403).json({ message: "Profile not yet created. Please complete your profile first." });
      const user = db.select().from(users).where(eq(users.id, userId)).get();
      if (!user) return res.status(404).json({ message: "User not found" });

      const { invitedEmail: _invitedEmail, recipientEmail, inviteType } = req.body;
      const invitedEmail = _invitedEmail || recipientEmail; // accept both field names
      // inviteType: 'mc_to_caregiver' | 'caregiver_to_mc' | 'mc_to_family' | 'mc_to_self_cg' | 'self_care_to_mc'
      const validTypes = ["mc_to_caregiver", "caregiver_to_mc", "mc_to_family", "mc_to_client", "mc_to_self_cg", "self_care_to_mc"];
      if (!inviteType || !validTypes.includes(inviteType)) {
        return res.status(400).json({ message: "Invalid invite type" });
      }

      // Get the client/loved one name for the landing page
      let clientName: string | null = null;
      if (user.clientId) {
        const client = db.select().from(clients).where(eq(clients.id, user.clientId)).get();
        clientName = client?.name ?? null;
      }

      // Expire any existing pending invite for this sender+email+type to prevent duplicates
      if (invitedEmail) {
        const existingPending = db.select().from(connectionInvites)
          .where(and(
            eq(connectionInvites.senderUserId, user.id),
            eq(connectionInvites.invitedEmail, invitedEmail.trim()),
            eq(connectionInvites.inviteType, inviteType),
            eq(connectionInvites.status, "pending")
          )).all();
        if (existingPending.length > 0) {
          for (const old of existingPending) {
            db.update(connectionInvites).set({ status: "expired" })
              .where(eq(connectionInvites.id, old.id)).run();
          }
        }
      }

      const token = generateToken(32);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
      const now = new Date().toISOString();
      const senderName = user.name || account.email || "Your Care Net Portal connection";
      const senderRole = user.role || "caregiver";

      db.insert(connectionInvites).values({
        token,
        senderUserId: user.id,
        senderRole,
        clientId: user.clientId ?? null,
        clientName,
        senderName,
        invitedEmail: invitedEmail || null,
        inviteType,
        status: "pending",
        expiresAt,
        createdAt: now,
      }).run();

      const appUrl = process.env.APP_URL || "https://care-net-portal-production.up.railway.app";
      const inviteUrl = `${appUrl}/#/invite/${token}`;

      // Optionally send invite email if email provided
      if (invitedEmail) {
        const roleLabel = inviteType === "mc_to_caregiver" ? "caregiver" :
                          inviteType === "caregiver_to_mc" ? "family contact" :
                          inviteType === "mc_to_self_cg" ? "Self-Caregiver" :
                          inviteType === "self_care_to_mc" ? "Main Contact" : "family member";
        await sendEmail({
          to: invitedEmail,
          subject: `${senderName} invited you to Care Net Portal`,
          html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #28251D;">
              <div style="background: #01696F; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 22px;">Care Net Portal</h1>
                <p style="margin: 8px 0 0; opacity: 0.85;">You've been invited</p>
              </div>
              <div style="background: #F7F6F2; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #D4D1CA;">
                <p style="font-size: 16px;"><strong>${senderName}</strong> has invited you to connect on Care Net Portal as a <strong>${roleLabel}</strong>${clientName ? ` for <strong>${clientName}</strong>` : ""}.</p>
                <p style="color: #5A5957; font-size: 14px;">Care Net Portal is a private care coordination platform that keeps caregivers and families connected with compassion and clarity.</p>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="${inviteUrl}" style="background: #01696F; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">Accept Invitation</a>
                </div>
                <p style="color: #BAB9B4; font-size: 12px; text-align: center;">This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.</p>
              </div>
            </div>
          `,
        });
      }

      res.json({ success: true, inviteUrl, token });
    } catch (err: any) {
      console.error("[invite/create] ERROR:", err?.message || err);
      res.status(500).json({ message: "Failed to create invite" });
    }
  });

  // GET /api/invite/:token — public: validate token + return context for landing page
  app.get("/api/invite/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const invite = db.select().from(connectionInvites)
        .where(eq(connectionInvites.token, token)).get();

      if (!invite) return res.status(404).json({ message: "Invite not found" });
      if (invite.status !== "pending") return res.status(410).json({ message: "This invite has already been used", status: invite.status });
      if (new Date(invite.expiresAt) < new Date()) {
        db.update(connectionInvites).set({ status: "expired" })
          .where(eq(connectionInvites.token, token)).run();
        return res.status(410).json({ message: "This invite link has expired" });
      }

      res.json({
        valid: true,
        senderName: invite.senderName,
        senderRole: invite.senderRole,
        clientName: invite.clientName,
        inviteType: invite.inviteType,
        invitedEmail: invite.invitedEmail,
      });
    } catch (err: any) {
      console.error("[invite/get] ERROR:", err?.message || err);
      res.status(500).json({ message: "Failed to validate invite" });
    }
  });

  // POST /api/invite/refer — send a general app referral email ("invite a friend")
  app.post("/api/invite/refer", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { email, senderName } = req.body;
      if (!email) return res.status(400).json({ message: "Email required" });
      const appUrl = process.env.APP_URL || "https://care-net-portal-production.up.railway.app";
      await sendEmail({
        to: email,
        subject: `${senderName || "Someone"} thinks you'd love Care Net Portal`,
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #28251D;">
            <div style="background: #01696F; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 22px;">Care Net Portal</h1>
              <p style="margin: 8px 0 0; opacity: 0.85;">Private care coordination for families</p>
            </div>
            <div style="background: #F7F6F2; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #D4D1CA;">
              <p style="font-size: 16px; margin-top: 0;">Hi there,</p>
              <p style="font-size: 15px;"><strong>${senderName || "A friend"}</strong> thought you might benefit from Care Net Portal — a private app that helps families coordinate care for a loved one.</p>
              <p style="font-size: 14px; color: #5A5957;">It keeps caregivers, family contacts, and loved ones connected through shared schedules, care logs, and real-time updates — all in one private space.</p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${appUrl}/#/apply" style="background: #01696F; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">Apply for Access</a>
              </div>
              <p style="font-size: 12px; color: #BAB9B4; text-align: center;">Care Net Portal is currently in private beta. Your friend's referral gets you in.</p>
            </div>
          </div>
        `,
      });
      res.json({ success: true });
    } catch (err: any) {
      console.error("[invite/refer] ERROR:", err?.message || err);
      res.status(500).json({ message: "Failed to send referral" });
    }
  });

  // GET /api/users/lookup-by-email?email=...&lookingFor=caregiver|family
  // lookingFor=caregiver  → MC searching for a CG to connect with
  // lookingFor=family     → CG searching for an MC/family member to connect with
  app.get("/api/users/lookup-by-email", requireAuth, (req: AuthRequest, res) => {
    try {
      const email = (req.query.email as string || "").trim().toLowerCase();
      const lookingFor = (req.query.lookingFor as string || "caregiver");
      if (!email) return res.status(400).json({ message: "Email required" });
      const account = db.select().from(authAccounts).where(eq(authAccounts.email, email)).get();
      if (!account || !account.userId) return res.json({ found: false });
      const user = db.select().from(users).where(eq(users.id, account.userId)).get();
      if (!user || !user.isActive) return res.json({ found: false });
      const caregiverRoles = ["caregiver", "multi_caregiver", "temp_caregiver"];
      const familyRoles = ["primary_family", "secondary_family"];
      const allowedRoles = lookingFor === "family" ? familyRoles : caregiverRoles;
      if (!allowedRoles.includes(user.role)) return res.json({ found: false, wrongRole: true });
      res.json({
        found: true,
        userId: user.id,
        name: user.name,
        avatarInitials: user.avatarInitials || user.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?",
        role: user.role,
      });
    } catch (err: any) {
      console.error("[lookup-by-email] ERROR:", err?.message || err);
      res.status(500).json({ message: "Lookup failed" });
    }
  });

  // POST /api/invite/direct-connect — MC finds existing CNP caregiver by email and sends them a connection request
  app.post("/api/invite/direct-connect", requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.authUserId;
      if (!userId) return res.status(403).json({ message: "Profile not linked" });
      const senderUser = db.select().from(users).where(eq(users.id, userId)).get();
      if (!senderUser) return res.status(404).json({ message: "Sender not found" });

      const { targetEmail, targetUserId, inviteType: rawInviteType } = req.body;
      if (!targetEmail || !targetUserId) return res.status(400).json({ message: "targetEmail and targetUserId required" });
      const validTypes = ["mc_to_caregiver", "caregiver_to_mc", "mc_to_family", "mc_to_client", "mc_to_self_cg", "self_care_to_mc"];
      const resolvedInviteType = validTypes.includes(rawInviteType) ? rawInviteType : "mc_to_caregiver";

      // Verify target is a real active user
      const targetUser = db.select().from(users).where(eq(users.id, Number(targetUserId))).get();
      if (!targetUser || !targetUser.isActive) return res.status(404).json({ message: "User not found" });

      // Build the invite token
      const token = generateToken(32);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      const senderName = senderUser.name || account.email || "A Care Net Portal member";
      let clientName: string | null = null;
      if (senderUser.clientId) {
        const client = db.select().from(clients).where(eq(clients.id, senderUser.clientId)).get();
        clientName = client?.name ?? null;
      }

      db.insert(connectionInvites).values({
        token,
        senderUserId: senderUser.id,
        senderRole: senderUser.role,
        clientId: senderUser.clientId ?? null,
        clientName,
        senderName,
        invitedEmail: targetEmail,
        inviteType: resolvedInviteType,
        status: "pending",
        expiresAt,
        createdAt: now,
      }).run();

      const appUrl = process.env.APP_URL || "https://care-net-portal-production.up.railway.app";
      const acceptUrl = `${appUrl}/#/invite/${token}`;
      const lovedOneLine = clientName ? ` to help care for <strong>${clientName}</strong>` : "";

      // Send a direct "you've been requested" email to the caregiver
      await sendEmail({
        to: targetEmail,
        subject: `${senderName} wants to connect with you on Care Net Portal`,
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #28251D;">
            <div style="background: #01696F; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 22px;">Care Net Portal</h1>
              <p style="margin: 8px 0 0; opacity: 0.85;">Connection Request</p>
            </div>
            <div style="background: #F7F6F2; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #D4D1CA;">
              <p style="font-size: 16px;"><strong>${senderName}</strong> has sent you a connection request on Care Net Portal${lovedOneLine}.</p>
              <p style="color: #5A5957; font-size: 14px;">Since you're already on Care Net Portal, just tap the button below to accept. No signup needed.</p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${acceptUrl}" style="background: #01696F; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">Accept Connection</a>
              </div>
              <p style="color: #BAB9B4; font-size: 12px; text-align: center;">This request expires in 7 days. You can also find it under your notifications in the app.</p>
            </div>
          </div>
        `,
      });

      res.json({ success: true, token });
    } catch (err: any) {
      console.error("[direct-connect] ERROR:", err?.message || err);
      res.status(500).json({ message: "Failed to send connection request" });
    }
  });

  // POST /api/invite/:token/accept — authenticated user accepts the invite
  app.post("/api/invite/:token/accept", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { token } = req.params;
      const acceptingUser = db.select().from(users).where(eq(users.id, req.authUserId!)).get();
      if (!acceptingUser) return res.status(404).json({ message: "User not found" });

      const invite = db.select().from(connectionInvites)
        .where(eq(connectionInvites.token, token)).get();
      if (!invite) return res.status(404).json({ message: "Invite not found" });
      if (invite.status !== "pending") return res.status(410).json({ message: "This invite has already been used" });
      if (new Date(invite.expiresAt) < new Date()) return res.status(410).json({ message: "This invite has expired" });

      const sender = db.select().from(users).where(eq(users.id, invite.senderUserId)).get();

      const now = new Date().toISOString();

      // Determine which user is the caregiver and which is the MC/family
      // Then link them via a shared clientId
      let clientId = invite.clientId;

      if (invite.inviteType === "mc_to_caregiver") {
        // Sender is MC (has clientId), acceptor is CG — give CG the real clientId.
        // Option A: sample client is NEVER deleted. We only switch the CG's active clientId.
        clientId = invite.clientId ?? sender?.clientId ?? null;
        if (clientId) {
          db.update(users).set({ clientId }).where(eq(users.id, acceptingUser.id)).run();
          // Seed junction table so CG appears correctly in Care Team view
          const existingRelCG = db.select().from(userClientRelationships)
            .where(and(eq(userClientRelationships.userId, acceptingUser.id), eq(userClientRelationships.clientId, clientId))).get();
          if (!existingRelCG) {
            const relCountCG = db.select().from(userClientRelationships).where(eq(userClientRelationships.userId, acceptingUser.id)).all().length;
            db.insert(userClientRelationships).values({
              userId: acceptingUser.id, clientId, role: 'caregiver',
              isPrimary: relCountCG === 0, createdAt: now,
            }).run();
          } else {
            db.update(userClientRelationships).set({ role: 'caregiver' })
              .where(and(eq(userClientRelationships.userId, acceptingUser.id), eq(userClientRelationships.clientId, clientId))).run();
          }
        }
      } else if (invite.inviteType === "caregiver_to_mc") {
        // Sender is CG (has clientId), acceptor is MC — share the clientId and set role.
        // Option A: sample client on CG sender is NEVER deleted; only the active clientId switches.
        clientId = invite.clientId ?? sender?.clientId ?? null;
        if (clientId) {
          // If the CG sender's current clientId points to a practice client, their real clientId
          // will come from the MC side — do NOT delete the practice client (Option A).
          const cgCurrentClient = clientId ? db.select().from(clients).where(eq(clients.id, clientId)).get() : null;
          if (cgCurrentClient?.isPractice) {
            clientId = null; // real clientId resolved after MC finishes their setup
          }
          if (clientId) {
            db.update(users).set({ clientId, role: "primary_family" }).where(eq(users.id, acceptingUser.id)).run();
            // Set as primaryContactId on the client record
            db.update(clients).set({ primaryContactId: acceptingUser.id }).where(eq(clients.id, clientId)).run();
            // Seed junction row so MC appears correctly in Care Team view
            const existingRelCTM = db.select().from(userClientRelationships)
              .where(and(eq(userClientRelationships.userId, acceptingUser.id), eq(userClientRelationships.clientId, clientId))).get();
            if (!existingRelCTM) {
              const relCountCTM = db.select().from(userClientRelationships).where(eq(userClientRelationships.userId, acceptingUser.id)).all().length;
              db.insert(userClientRelationships).values({
                userId: acceptingUser.id, clientId, role: 'mc',
                isPrimary: relCountCTM === 0, createdAt: now,
              }).run();
            } else {
              db.update(userClientRelationships).set({ role: 'mc' })
                .where(and(eq(userClientRelationships.userId, acceptingUser.id), eq(userClientRelationships.clientId, clientId))).run();
            }
          }
        } else if (acceptingUser.clientId) {
          // MC already has a client — share it back to the CG sender, still mark acceptor as primary_family
          if (sender) {
            db.update(users).set({ clientId: acceptingUser.clientId }).where(eq(users.id, sender.id)).run();
            // Seed junction row for the CG sender on this client
            const existingRelCGBack = db.select().from(userClientRelationships)
              .where(and(eq(userClientRelationships.userId, sender.id), eq(userClientRelationships.clientId, acceptingUser.clientId))).get();
            if (!existingRelCGBack) {
              const relCountCGBack = db.select().from(userClientRelationships).where(eq(userClientRelationships.userId, sender.id)).all().length;
              db.insert(userClientRelationships).values({
                userId: sender.id, clientId: acceptingUser.clientId, role: 'caregiver',
                isPrimary: relCountCGBack === 0, createdAt: now,
              }).run();
            } else {
              db.update(userClientRelationships).set({ role: 'caregiver' })
                .where(and(eq(userClientRelationships.userId, sender.id), eq(userClientRelationships.clientId, acceptingUser.clientId))).run();
            }
          }
          clientId = acceptingUser.clientId;
          db.update(users).set({ role: "primary_family" }).where(eq(users.id, acceptingUser.id)).run();
          // Set as primaryContactId on the client record
          db.update(clients).set({ primaryContactId: acceptingUser.id }).where(eq(clients.id, clientId)).run();
          // Seed junction row for the MC acceptor
          const existingRelMCBack = db.select().from(userClientRelationships)
            .where(and(eq(userClientRelationships.userId, acceptingUser.id), eq(userClientRelationships.clientId, clientId))).get();
          if (!existingRelMCBack) {
            const relCountMCBack = db.select().from(userClientRelationships).where(eq(userClientRelationships.userId, acceptingUser.id)).all().length;
            db.insert(userClientRelationships).values({
              userId: acceptingUser.id, clientId, role: 'mc',
              isPrimary: relCountMCBack === 0, createdAt: now,
            }).run();
          } else {
            db.update(userClientRelationships).set({ role: 'mc' })
              .where(and(eq(userClientRelationships.userId, acceptingUser.id), eq(userClientRelationships.clientId, clientId))).run();
          }
        }
      } else if (invite.inviteType === "mc_to_family") {
        // Sender is MC, acceptor is secondary family — give them read access to same client.
        // If they already have a clientId (multi-portal), don't overwrite — just add a relationship row.
        clientId = invite.clientId ?? sender?.clientId ?? null;
        if (clientId) {
          const alreadyHasClient = !!acceptingUser.clientId;
          if (!alreadyHasClient) {
            // First portal — stamp clientId on user row
            db.update(users).set({ clientId, role: "secondary_family" })
              .where(eq(users.id, acceptingUser.id)).run();
          } else {
            // Additional portal — just ensure role is correct
            db.update(users).set({ role: "secondary_family" }).where(eq(users.id, acceptingUser.id)).run();
          }
          // Always write a relationship row so Care Home multi-portal switcher works
          const existingRelFM = db.select().from(userClientRelationships)
            .where(and(eq(userClientRelationships.userId, acceptingUser.id), eq(userClientRelationships.clientId, clientId))).get();
          if (!existingRelFM) {
            const relCountFM = db.select().from(userClientRelationships).where(eq(userClientRelationships.userId, acceptingUser.id)).all().length;
            db.insert(userClientRelationships).values({
              userId: acceptingUser.id, clientId, role: "secondary_family",
              isPrimary: relCountFM === 0, createdAt: new Date().toISOString(),
            }).run();
          }
        }
      } else if (invite.inviteType === "mc_to_client") {
        // Sender is MC, acceptor is the care recipient — give them full self_care_mc access.
        // All self_care users get the same permissions regardless of signup path.
        clientId = invite.clientId ?? sender?.clientId ?? null;
        if (clientId) {
          db.update(users).set({ clientId, role: "self_care", permissionLevel: "self_care_mc" })
            .where(eq(users.id, acceptingUser.id)).run();
          // Link the client record back to this user account
          storage.linkClientUser(clientId, acceptingUser.id);
        }
      } else if (invite.inviteType === "mc_to_self_cg") {
        // Path B: MC invites an adult to be their own self-caregiver.
        // Acceptor becomes self_care / self_care_mc and IS the client.
        // MC stays as primary_family (monitoring role). Ability ≠ authority.
        clientId = invite.clientId ?? sender?.clientId ?? null;
        if (clientId) {
          db.update(users).set({ clientId, role: "self_care", permissionLevel: "self_care_mc" })
            .where(eq(users.id, acceptingUser.id)).run();
          // Self-link: this user is now the client
          storage.linkClientUser(clientId, acceptingUser.id);
        }
      } else if (invite.inviteType === "self_care_to_mc") {
        // Path A MC half: self-care user invited mom/family as Main Contact.
        // Acceptor gets primary_family role on the sender's client.
        clientId = invite.clientId ?? sender?.clientId ?? null;
        if (clientId) {
          db.update(users).set({ clientId, role: "primary_family" })
            .where(eq(users.id, acceptingUser.id)).run();
          // Set as primaryContactId on the client record
          db.update(clients).set({ primaryContactId: acceptingUser.id })
            .where(eq(clients.id, clientId)).run();
          // Seed junction table so MC appears correctly in Care Team view
          const existingRelMC = db.select().from(userClientRelationships)
            .where(and(eq(userClientRelationships.userId, acceptingUser.id), eq(userClientRelationships.clientId, clientId))).get();
          if (!existingRelMC) {
            const relCountMC = db.select().from(userClientRelationships).where(eq(userClientRelationships.userId, acceptingUser.id)).all().length;
            db.insert(userClientRelationships).values({
              userId: acceptingUser.id, clientId, role: 'mc',
              isPrimary: relCountMC === 0, createdAt: now,
            }).run();
          } else {
            db.update(userClientRelationships).set({ role: 'mc' })
              .where(and(eq(userClientRelationships.userId, acceptingUser.id), eq(userClientRelationships.clientId, clientId))).run();
          }
        }
      }

      // Mark invite accepted
      db.update(connectionInvites).set({
        status: "accepted",
        acceptedByUserId: acceptingUser.id,
        acceptedAt: now,
      }).where(eq(connectionInvites.token, token)).run();

      // Notify sender that their invite was accepted
      if (sender) {
        const senderAccount = db.select().from(authAccounts)
          .where(eq(authAccounts.userId, sender.id)).get();
        if (senderAccount?.email) {
          await sendEmail({
            to: senderAccount.email,
            subject: `${acceptingUser.name || "Someone"} accepted your Care Net Portal invitation`,
            html: `
              <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #28251D;">
                <div style="background: #01696F; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="margin: 0; font-size: 22px;">Care Net Portal</h1>
                  <p style="margin: 8px 0 0; opacity: 0.85;">Connection accepted</p>
                </div>
                <div style="background: #F7F6F2; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #D4D1CA;">
                  <p style="font-size: 16px;"><strong>${acceptingUser.name || "Your contact"}</strong> has accepted your invitation and joined Care Net Portal. Your portals are now connected.</p>
                  <div style="text-align: center; margin: 24px 0;">
                    <a href="${process.env.APP_URL || "https://care-net-portal-production.up.railway.app"}" style="background: #01696F; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">Open Portal</a>
                  </div>
                </div>
              </div>
            `,
          });
        }
      }

      res.json({ success: true, clientId, message: "Portals connected successfully" });
    } catch (err: any) {
      console.error("[invite/accept] ERROR:", err?.message || err);
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  // GET /api/notifications/prefs — get current user's notification preferences
  app.get("/api/notifications/prefs", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = db.select().from(users).where(eq(users.id, req.authUserId!)).get();
      const prefs = user?.notificationPrefs
        ? JSON.parse(user.notificationPrefs as string)
        : { careLog: true, messages: true, schedule: true, vitals: false };
      res.json({ prefs });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load preferences" });
    }
  });

  // PATCH /api/notifications/prefs — update notification preferences
  app.patch("/api/notifications/prefs", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { prefs } = req.body;
      if (!prefs || typeof prefs !== "object") return res.status(400).json({ message: "Invalid prefs" });
      db.update(users)
        .set({ notificationPrefs: JSON.stringify(prefs) })
        .where(eq(users.id, req.authUserId!))
        .run();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to save preferences" });
    }
  });

  // GET /api/user/font-size — get current user's font size preference
  app.get("/api/user/font-size", requireAuth, (req: AuthRequest, res) => {
    try {
      const user = db.select().from(users).where(eq(users.id, req.authUserId!)).get();
      res.json({ fontSizePreference: user?.fontSizePreference || "normal" });
    } catch (err: any) { res.status(500).json({ message: err?.message }); }
  });

  // PATCH /api/user/font-size — update current user's font size preference
  app.patch("/api/user/font-size", requireAuth, (req: AuthRequest, res) => {
    try {
      const { fontSizePreference } = req.body;
      if (!["normal", "large", "x-large"].includes(fontSizePreference))
        return res.status(400).json({ message: "Invalid font size" });
      db.update(users).set({ fontSizePreference }).where(eq(users.id, req.authUserId!)).run();
      res.json({ success: true, fontSizePreference });
    } catch (err: any) { res.status(500).json({ message: err?.message }); }
  });

  // ── Help Desk ────────────────────────────────────────────────────────────

  // POST /api/helpdesk/chat — AI-powered support chat (Gemini 1.5 Flash)
  app.post("/api/helpdesk/chat", requireAuth, async (req: AuthRequest, res) => {
    const { message, context, history = [], sessionId } = req.body;
    if (!message) return res.status(400).json({ message: "No message provided" });

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.json({
        reply: "I'm not fully set up yet. For help, please email portal@carenetportal.com and someone will assist you shortly.",
        shouldEscalate: false,
      });
    }

    try {
      const systemPrompt = buildSystemPrompt(context || {});

      // Gemini uses a different message format — system instruction separate,
      // history as alternating user/model turns
      const geminiHistory = history.slice(-10).map((h: any) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      }));

      const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [
          ...geminiHistory,
          { role: "user", parts: [{ text: message }] },
        ],
        generationConfig: {
          maxOutputTokens: 600,
          temperature: 0.7,
        },
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Gemini error: ${response.status} — ${errBody.slice(0, 200)}`);
      }

      const data = await response.json() as any;
      const reply =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "I didn't get a response. Please try again.";

      // Detect if escalation should be offered
      const lowerReply = reply.toLowerCase();
      const lowerMsg = message.toLowerCase();
      const shouldEscalate =
        lowerMsg.includes("talk to a person") ||
        lowerMsg.includes("contact support") ||
        lowerMsg.includes("real person") ||
        lowerMsg.includes("email") ||
        (history.length >= 4 && lowerReply.includes("not sure")) ||
        (history.length >= 6);

      res.json({ reply, shouldEscalate });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error("[helpdesk/chat] ERROR:", errMsg, err?.stack?.slice(0, 300));
      // Return a useful answer for the most common question rather than a dead end
      const lowerMsg = (req.body?.message || "").toLowerCase();
      let fallbackReply = "I'm having a moment of trouble. For immediate help, email portal@carenetportal.com.";
      if (lowerMsg.includes("blood pressure") || lowerMsg.includes("vitals") || lowerMsg.includes("bp")) {
        fallbackReply = "Blood pressure is logged in the Vitals section. Tap \"Vitals\" in your navigation menu, then tap \"Log Vitals\" to add a new reading. You can track systolic, diastolic, and pulse together.";
      } else if (lowerMsg.includes("medication") || lowerMsg.includes("med")) {
        fallbackReply = "Medications are in the Medications section of your navigation. Tap the green \"Add Medication\" button to add a new one.";
      } else if (lowerMsg.includes("care log") || lowerMsg.includes("activity") || lowerMsg.includes("log")) {
        fallbackReply = "Care log entries are added from the Care Log page. Tap \"Log Activity\" to write a new entry.";
      }
      res.json({
        reply: fallbackReply,
        shouldEscalate: false,
      });
    }
  });

  // POST /api/helpdesk/escalate — store escalation + send email to support
  app.post("/api/helpdesk/escalate", requireAuth, async (req: AuthRequest, res) => {
    const { sessionId, userName, userRole, currentPage, history = [] } = req.body;

    try {
      // Store for learning / review
      db.insert(helpdeskEscalations).values({
        sessionId: sessionId || "unknown",
        userName: userName || null,
        userRole: userRole || null,
        currentPage: currentPage || null,
        conversation: JSON.stringify(history),
        createdAt: new Date().toISOString(),
      }).run();

      // Build readable transcript
      const transcript = history
        .map((m: any) => `[${m.role === "user" ? (userName || "User") : "Support AI"}]\n${m.content}`)
        .join("\n\n");

      const emailBody = `
A Care Net Portal user has requested support and could not be resolved by the AI assistant.

User: ${userName || "Unknown"}
Role: ${userRole || "Unknown"}
Page: ${currentPage || "Unknown"}
Time: ${new Date().toLocaleString()}

─────────────────────────────────
CONVERSATION TRANSCRIPT
─────────────────────────────────

${transcript}

─────────────────────────────────
Please follow up with this user. The conversation above contains everything needed to assist them.
      `.trim();

      await sendEmail({
        to: "portal@carenetportal.com",
        subject: `[Help Desk] Support request from ${userName || "a user"} — ${currentPage || "unknown page"}`,
        text: emailBody,
        html: `<pre style="font-family:monospace;white-space:pre-wrap">${emailBody}</pre>`,
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("[helpdesk/escalate] ERROR:", err?.message || err);
      res.status(500).json({ message: "Failed to send escalation" });
    }
  });

  // GET /api/admin/helpdesk — list escalations for Becky Admin
  app.get("/api/admin/helpdesk", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const escalations = db.select().from(helpdeskEscalations)
        .orderBy(helpdeskEscalations.createdAt)
        .all()
        .reverse(); // newest first
      res.json(escalations);
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // PATCH /api/admin/helpdesk/:id — mark resolved + add resolution note
  app.patch("/api/admin/helpdesk/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const id = parseInt(req.params.id);
    const { resolved, resolution } = req.body;
    try {
      db.update(helpdeskEscalations)
        .set({ resolved: resolved ?? true, resolution: resolution || null })
        .where(eq(helpdeskEscalations.id, id))
        .run();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // IDEAS ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  // POST /api/ideas — submit a new idea, auto-tag with Gemini
  app.post("/api/ideas", requireAuthAccount, async (req: AuthRequest, res) => {
    const { text, page } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Idea text is required" });

    const account = db.select().from(authAccounts).where(eq(authAccounts.id, req.authAccountId!)).get();
    const user = account?.userId ? db.select().from(users).where(eq(users.id, account.userId)).get() : null;

    // Save immediately — Gemini tagging is best-effort
    const now = new Date().toISOString();
    const idea = storage.createIdea({
      userId: user?.id ?? null,
      userRole: user?.role ?? null,
      text: text.trim(),
      page: page || null,
      careContext: null,
      ideaType: null,
      clusterId: null,
      clusterLabel: null,
      geminiSummary: null,
      status: "new",
      adminNote: null,
      createdAt: now,
    });

    // Fire Gemini tagging async — don't block response
    res.json({ success: true, ideaId: idea.id });

    // Async Gemini tagging
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) return;

      // Fetch existing ideas for similarity context (last 50)
      const existing = storage.getAllIdeas().slice(0, 50);
      const existingSummary = existing
        .filter(i => i.id !== idea.id && i.clusterId)
        .map(i => `[${i.clusterId}] ${i.text.slice(0, 80)}`)
        .slice(0, 20)
        .join("\n");

      const prompt = `You are organizing user feedback for a healthcare caregiver app called Care Net Portal.

New idea submitted:
"${text.trim()}"

Existing idea clusters for similarity reference:
${existingSummary || "(none yet)"}

Respond with a JSON object (no markdown, no code fences) with these fields:
- careContext: one of "universal", "elderly", "special_needs", "short_term", "self_managed"
- ideaType: one of "missing_feature", "friction_point", "emotional_need", "safety"
- clusterId: a short kebab-case key grouping similar ideas (e.g. "medication-logging", "schedule-reminders"). Match an existing cluster if this idea is clearly about the same need.
- clusterLabel: a human-readable 2-5 word label for the cluster (e.g. "Medication Logging")
- geminiSummary: a single sentence synthesizing this idea's core need (max 20 words)`;

      const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.3 },
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );

      if (response.ok) {
        const data = await response.json() as any;
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        // Strip markdown fences if present
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned);
        storage.updateIdea(idea.id, {
          careContext: parsed.careContext || null,
          ideaType: parsed.ideaType || null,
          clusterId: parsed.clusterId || null,
          clusterLabel: parsed.clusterLabel || null,
          geminiSummary: parsed.geminiSummary || null,
        });
      }
    } catch (e) {
      console.error("[ideas] Gemini tagging failed:", e);
    }
  });

  // GET /api/admin/ideas — all ideas grouped by cluster (admin only)
  app.get("/api/admin/ideas", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const clusters = storage.getIdeasByCluster();
      res.json(clusters);
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // PATCH /api/admin/ideas/:id — update status or admin note
  app.patch("/api/admin/ideas/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const id = parseInt(req.params.id);
    const { status, adminNote } = req.body;
    try {
      const updated = storage.updateIdea(id, {
        ...(status ? { status } : {}),
        ...(adminNote !== undefined ? { adminNote } : {}),
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // HEALTH HISTORY ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/clients/:clientId/health-history — all entries, sorted newest year first
  app.get("/api/clients/:clientId/health-history", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    try {
      const clientId = Number(req.params.clientId);
      const entries = db.select().from(healthHistoryEntries)
        .where(eq(healthHistoryEntries.clientId, clientId))
        .all()
        .sort((a, b) => {
          const yearDiff = (b.dateYear ?? 0) - (a.dateYear ?? 0);
          if (yearDiff !== 0) return yearDiff;
          return (b.dateMonth ?? 0) - (a.dateMonth ?? 0);
        });
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // POST /api/clients/:clientId/health-history — add new entry
  app.post("/api/clients/:clientId/health-history", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    try {
      const clientId = Number(req.params.clientId);
      const userId = req.authUserId!;
      const { entryType, title, dateApprox, dateYear, dateMonth, dateDay, facility, provider, outcome, notes, isSignificant } = req.body;
      if (!entryType || !title) return res.status(400).json({ message: "entryType and title are required" });
      const entry = db.insert(healthHistoryEntries).values({
        clientId,
        addedByUserId: userId,
        entryType,
        title,
        dateApprox: dateApprox || null,
        dateYear: dateYear ? Number(dateYear) : null,
        dateMonth: dateMonth ? Number(dateMonth) : null,
        dateDay: dateDay ? Number(dateDay) : null,
        facility: facility || null,
        provider: provider || null,
        outcome: outcome || null,
        notes: notes || null,
        isSignificant: !!isSignificant,
        createdAt: new Date().toISOString(),
      }).returning().get();
      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // DELETE /api/clients/:clientId/health-history/:entryId
  app.delete("/api/clients/:clientId/health-history/:entryId", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    try {
      const entryId = Number(req.params.entryId);
      db.delete(healthHistoryEntries).where(eq(healthHistoryEntries.id, entryId)).run();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // GET /api/clients/:clientId/health-history/:entryId/logs — care log entries linked to this history event
  app.get("/api/clients/:clientId/health-history/:entryId/logs", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    try {
      const entryId = Number(req.params.entryId);
      const logs = db.select().from(activityLogs)
        .where(eq(activityLogs.healthHistoryEntryId, entryId))
        .orderBy(activityLogs.loggedAt)
        .all();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CARE HOME — MULTI-CLIENT ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/me/portals — all client portals for logged-in user
  app.get("/api/me/portals", requireAuth, (req: AuthRequest, res) => {
    try {
      const userId = req.authUserId!;
      const relationships = db.select().from(userClientRelationships)
        .where(eq(userClientRelationships.userId, userId))
        .all();
      if (relationships.length === 0) return res.json([]);
      const result = relationships.map(r => {
        const client = db.select().from(clients).where(eq(clients.id, r.clientId)).get();
        return {
          relationshipId: r.id,
          clientId: r.clientId,
          role: r.role,
          isPrimary: r.isPrimary,
          clientName: client?.name || "Unknown",
          colorTheme: client?.colorTheme || "teal",
          primaryCondition: client?.primaryCondition || null,
          dateOfBirth: client?.dateOfBirth || null,
        };
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // POST /api/me/portals/set-primary — set which portal loads by default
  app.post("/api/me/portals/set-primary", requireAuth, (req: AuthRequest, res) => {
    try {
      const userId = req.authUserId!;
      const { clientId } = req.body;
      // Clear all isPrimary for this user, then set the chosen one
      sqlite.prepare(`UPDATE user_client_relationships SET is_primary = 0 WHERE user_id = ?`).run(userId);
      sqlite.prepare(`UPDATE user_client_relationships SET is_primary = 1 WHERE user_id = ? AND client_id = ?`).run(userId, clientId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // PATCH /api/clients/:clientId/color-theme — MC sets portal color
  app.patch("/api/clients/:clientId/color-theme", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    try {
      const clientId = Number(req.params.clientId);
      const { colorTheme } = req.body;
      const valid = ['teal', 'sage', 'slate', 'rose', 'amber'];
      if (!valid.includes(colorTheme)) return res.status(400).json({ message: 'Invalid color theme' });
      db.update(clients).set({ colorTheme }).where(eq(clients.id, clientId)).run();
      res.json({ success: true, colorTheme });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // POST /api/me/portals/add-client — MC adds a second (or more) client
  // Creates a new client record and junction row, kicks off setup flow
  app.post("/api/me/portals/add-client", requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.authUserId!;
      const user = db.select().from(users).where(eq(users.id, userId)).get();
      if (!user) return res.status(404).json({ message: 'User not found' });
      const { clientName, colorTheme, clientDob, clientCondition } = req.body;
      if (!clientName) return res.status(400).json({ message: 'clientName required' });
      // Create the new client record
      const newClient = db.insert(clients).values({
        name: clientName,
        caregiverId: userId,
        primaryContactId: userId,
        colorTheme: colorTheme || 'sage',
        isActive: true,
        dateOfBirth: clientDob || null,
        primaryCondition: clientCondition || null,
      }).returning().get();
      // Add junction row
      db.insert(userClientRelationships).values({
        userId,
        clientId: newClient.id,
        role: 'mc',
        isPrimary: false,
        createdAt: new Date().toISOString(),
      }).run();
      res.json({ success: true, clientId: newClient.id, clientName: newClient.name, colorTheme: newClient.colorTheme });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ── Temporary MC Elevation ─────────────────────────────────────────────────

  // Helper: is this user currently elevated to MC authority?
  function isEffectiveMC(user: any): boolean {
    if (user.role === "primary_family") return true;
    if (user.role === "secondary_family" && user.elevatedUntil) {
      return new Date(user.elevatedUntil) > new Date();
    }
    return false;
  }

  // POST /api/me/delegate — MC sets temporary elevation on a secondary FM
  // Body: { userId: number, elevatedUntil: string (ISO date) }
  app.post("/api/me/delegate", requireAuth, (req: AuthRequest, res) => {
    const authUserId = req.user?.id;
    if (!authUserId) return res.status(401).json({ error: "Unauthorized" });
    const authUser = db.select().from(users).where(eq(users.id, authUserId)).get();
    if (!authUser || authUser.role !== "primary_family") {
      return res.status(403).json({ error: "Only Main Contacts can delegate authority" });
    }
    const { userId, elevatedUntil } = req.body;
    if (!userId || !elevatedUntil) {
      return res.status(400).json({ error: "userId and elevatedUntil required" });
    }
    // Verify target user is secondary_family on same client
    const target = db.select().from(users).where(eq(users.id, Number(userId))).get();
    if (!target || target.role !== "secondary_family" || target.clientId !== authUser.clientId) {
      return res.status(403).json({ error: "Target must be a Secondary Family Member on the same portal" });
    }
    // Validate date is in the future and not more than 90 days out
    const until = new Date(elevatedUntil);
    const now = new Date();
    const maxDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    if (until <= now) return res.status(400).json({ error: "Elevation end date must be in the future" });
    if (until > maxDate) return res.status(400).json({ error: "Elevation cannot exceed 90 days" });
    db.update(users).set({ elevatedUntil }).where(eq(users.id, Number(userId))).run();
    console.log(`[delegate] User ${authUserId} elevated user ${userId} until ${elevatedUntil}`);
    return res.json({ success: true, elevatedUntil });
  });

  // DELETE /api/me/delegate/:userId — MC revokes elevation early
  app.delete("/api/me/delegate/:userId", requireAuth, (req: AuthRequest, res) => {
    const authUserId = req.user?.id;
    if (!authUserId) return res.status(401).json({ error: "Unauthorized" });
    const authUser = db.select().from(users).where(eq(users.id, authUserId)).get();
    if (!authUser || authUser.role !== "primary_family") {
      return res.status(403).json({ error: "Only Main Contacts can revoke delegation" });
    }
    const targetId = Number(req.params.userId);
    const target = db.select().from(users).where(eq(users.id, targetId)).get();
    if (!target || target.clientId !== authUser.clientId) {
      return res.status(403).json({ error: "Target not found on this portal" });
    }
    db.update(users).set({ elevatedUntil: null }).where(eq(users.id, targetId)).run();
    console.log(`[delegate] User ${authUserId} revoked elevation for user ${targetId}`);
    return res.json({ success: true });
  });

  // GET /api/me/delegates — MC fetches current delegations for their portal
  app.get("/api/me/delegates", requireAuth, (req: AuthRequest, res) => {
    const authUserId = req.user?.id;
    if (!authUserId) return res.status(401).json({ error: "Unauthorized" });
    const authUser = db.select().from(users).where(eq(users.id, authUserId)).get();
    if (!authUser || authUser.role !== "primary_family") return res.json([]);
    const secondaryMembers = db.select().from(users)
      .where(and(eq(users.clientId, authUser.clientId!), eq(users.role, "secondary_family" as any)))
      .all();
    const now = new Date();
    return res.json(secondaryMembers.map(u => ({
      id: u.id, name: u.name, elevatedUntil: u.elevatedUntil ?? null,
      isActive: !!(u.elevatedUntil && new Date(u.elevatedUntil) > now),
    })));
  });

  // POST /api/me/nudge-snooze — snooze the multi-portal nudge card for 30 days
  app.post("/api/me/nudge-snooze", requireAuth, (req: AuthRequest, res) => {
    try {
      const userId = req.authUserId!;
      const snoozeUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      db.update(users).set({ multiPortalNudgeSnoozedUntil: snoozeUntil }).where(eq(users.id, userId)).run();
      res.json({ success: true, snoozedUntil: snoozeUntil });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ENGAGEMENT ADMIN ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/admin/engagement — all real users with last login, last activity, total entries
  app.get("/api/admin/engagement", requireAuth, requireAdmin, (req: AuthRequest, res) => {
    try {
      const allUsers = db.select().from(users).all();
      // Show all users except demo accounts — includes test accounts. Admins need full visibility.
      const DEMO_EMAILS = ['cnpdemo@carenetportal.com', 'democg@carenetportal.com'];
      const nonDemoUsers = allUsers.filter(u => !DEMO_EMAILS.includes((u.email || '').toLowerCase()));

      const result = nonDemoUsers.map(u => {
        const clientId = u.clientId;
        const account = sqlite.prepare(`SELECT last_login_at FROM auth_accounts WHERE user_id = ?`).get(u.id) as any;

        // Last activity = most recent timestamp across all care data for this user
        const lastActivityRows = [
          clientId ? sqlite.prepare(`SELECT logged_at as ts FROM activity_logs WHERE logged_by_user_id = ? ORDER BY logged_at DESC LIMIT 1`).get(u.id) as any : null,
          clientId ? sqlite.prepare(`SELECT scheduled_at as ts FROM schedule_events WHERE client_id = ? ORDER BY scheduled_at DESC LIMIT 1`).get(clientId) as any : null,
          clientId ? sqlite.prepare(`SELECT recorded_at as ts FROM vitals WHERE client_id = ? ORDER BY recorded_at DESC LIMIT 1`).get(clientId) as any : null,
          sqlite.prepare(`SELECT sent_at as ts FROM messages WHERE sender_id = ? ORDER BY sent_at DESC LIMIT 1`).get(u.id) as any,
        ].filter(Boolean).map(r => r?.ts).filter(Boolean);
        const lastActivityAt = lastActivityRows.length > 0 ? lastActivityRows.sort().reverse()[0] : null;

        // Total care data entries
        const totalEntries = [
          clientId ? (sqlite.prepare(`SELECT COUNT(*) as c FROM activity_logs WHERE logged_by_user_id = ?`).get(u.id) as any)?.c ?? 0 : 0,
          clientId ? (sqlite.prepare(`SELECT COUNT(*) as c FROM schedule_events WHERE client_id = ?`).get(clientId) as any)?.c ?? 0 : 0,
          clientId ? (sqlite.prepare(`SELECT COUNT(*) as c FROM vitals WHERE client_id = ?`).get(clientId) as any)?.c ?? 0 : 0,
          clientId ? (sqlite.prepare(`SELECT COUNT(*) as c FROM medications WHERE client_id = ?`).get(clientId) as any)?.c ?? 0 : 0,
        ].reduce((a, b) => a + b, 0);

        // Tier: active = logged in within 7 days, moderate = 8-30, quiet = 30+
        const lastLogin = account?.last_login_at ?? null;
        const daysSinceLogin = lastLogin ? Math.floor((Date.now() - new Date(lastLogin).getTime()) / 86400000) : 999;
        const tier = daysSinceLogin <= 7 ? 'active' : daysSinceLogin <= 30 ? 'moderate' : 'quiet';

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          clientId,
          lastLoginAt: lastLogin,
          lastActivityAt,
          totalEntries,
          daysSinceLogin,
          tier,
        };
      });

      // Sort by most active first (fewest days since login)
      result.sort((a, b) => a.daysSinceLogin - b.daysSinceLogin);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // POST /api/admin/feedback — user submits in-app feedback
  app.post("/api/admin/feedback", requireAuth, requireAdmin, (req: AuthRequest, res) => {
    const user = req.user!;
    const { message, triggerType } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: "Message required" });
    const account = db.select().from(authAccounts).where(eq(authAccounts.userId, user.id)).get();
    sqlite.prepare(
      `INSERT INTO user_feedback (user_id, user_name, user_email, user_role, trigger_type, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(user.id, user.name, account?.email ?? '', user.role, triggerType ?? 'general', message.trim(), new Date().toISOString());
    res.json({ success: true });
  });

  // GET /api/admin/feedback — all feedback for admin panel
  app.get("/api/admin/feedback", requireAuth, requireAdmin, (req: AuthRequest, res) => {
    const rows = sqlite.prepare(`SELECT * FROM user_feedback ORDER BY created_at DESC`).all();
    res.json(rows);
  });

  // PATCH /api/admin/feedback/:id/read — mark as read
  app.patch("/api/admin/feedback/:id/read", requireAuth, requireAdmin, (req: AuthRequest, res) => {
    sqlite.prepare(`UPDATE user_feedback SET read_at = ? WHERE id = ?`).run(new Date().toISOString(), Number(req.params.id));
    res.json({ success: true });
  });

  // BETA CLEANUP ADMIN ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/admin/beta-cleanup/users — all real (non-demo) users with entry counts
  app.get("/api/admin/beta-cleanup/users", requireAuth, requireAdmin, (req: AuthRequest, res) => {
    try {
      const allUsers = db.select().from(users).all();
      // Exclude demo users (id 1-5) by default — they're seed data, not beta testers
      const betaUsers = allUsers.filter(u => u.id > 5);
      const result = betaUsers.map(u => {
        const clientId = u.clientId;
        const counts: Record<string, number> = {
          careLogs: clientId ? db.select().from(activityLogs).where(and(eq(activityLogs.clientId, clientId), eq(activityLogs.loggedByUserId, u.id))).all().length : 0,
          scheduleEvents: clientId ? db.select().from(scheduleEvents).where(eq(scheduleEvents.clientId, clientId)).all().length : 0,
          vitals: clientId ? db.select().from(vitals).where(and(eq(vitals.clientId, clientId), eq(vitals.recordedByUserId, u.id))).all().length : 0,
          medications: clientId ? db.select().from(medications).where(eq(medications.clientId, clientId)).all().length : 0,
          thoughts: clientId ? db.select().from(thoughtEntries).where(eq(thoughtEntries.clientId, clientId)).all().length : 0,
          media: clientId ? db.select().from(mediaItems).where(eq(mediaItems.clientId, clientId)).all().length : 0,
          documents: clientId ? db.select().from(documents).where(eq(documents.clientId, clientId)).all().length : 0,
        };
        counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
        return { id: u.id, name: u.name, role: u.role, email: u.email, clientId, counts };
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // POST /api/admin/beta-cleanup/wipe — selective wipe for a user
  // Body: { userId, clientId, categories: string[] }
  // categories: 'careLogs' | 'scheduleEvents' | 'vitals' | 'medications' | 'thoughts' | 'media' | 'documents'
  app.post("/api/admin/beta-cleanup/wipe", requireAuth, requireAdmin, (req: AuthRequest, res) => {
    const { userId, clientId, categories } = req.body as { userId: number; clientId: number; categories: string[] };
    if (!userId || !clientId || !categories?.length) {
      return res.status(400).json({ message: "userId, clientId, and categories required" });
    }
    const wiped: Record<string, number> = {};
    try {
      if (categories.includes("careLogs")) {
        const rows = db.select().from(activityLogs).where(and(eq(activityLogs.clientId, clientId), eq(activityLogs.loggedByUserId, userId))).all();
        rows.forEach(r => db.delete(activityLogs).where(eq(activityLogs.id, r.id)).run());
        wiped.careLogs = rows.length;
      }
      if (categories.includes("scheduleEvents")) {
        const rows = db.select().from(scheduleEvents).where(eq(scheduleEvents.clientId, clientId)).all();
        rows.forEach(r => db.delete(scheduleEvents).where(eq(scheduleEvents.id, r.id)).run());
        wiped.scheduleEvents = rows.length;
      }
      if (categories.includes("vitals")) {
        const rows = db.select().from(vitals).where(and(eq(vitals.clientId, clientId), eq(vitals.recordedByUserId, userId))).all();
        rows.forEach(r => db.delete(vitals).where(eq(vitals.id, r.id)).run());
        wiped.vitals = rows.length;
      }
      if (categories.includes("medications")) {
        const rows = db.select().from(medications).where(eq(medications.clientId, clientId)).all();
        rows.forEach(r => db.delete(medications).where(eq(medications.id, r.id)).run());
        wiped.medications = rows.length;
      }
      if (categories.includes("thoughts")) {
        const rows = db.select().from(thoughtEntries).where(eq(thoughtEntries.clientId, clientId)).all();
        rows.forEach(r => db.delete(thoughtEntries).where(eq(thoughtEntries.id, r.id)).run());
        wiped.thoughts = rows.length;
      }
      if (categories.includes("media")) {
        const rows = db.select().from(mediaItems).where(eq(mediaItems.clientId, clientId)).all();
        rows.forEach(r => db.delete(mediaItems).where(eq(mediaItems.id, r.id)).run());
        wiped.media = rows.length;
      }
      if (categories.includes("documents")) {
        const rows = db.select().from(documents).where(and(eq(documents.clientId, clientId), eq(documents.uploadedByUserId, userId))).all();
        rows.forEach(r => db.delete(documents).where(eq(documents.id, r.id)).run());
        wiped.documents = rows.length;
      }
      res.json({ success: true, wiped });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // END AUTH ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  // ── Becky Admin — standalone server-rendered page (bypasses React/iframe) ──
  const escHtml = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  // ── CNU Audio — serve from backend so it works through the deployment proxy ──
  app.get("/cnu-audio/:file", (req, res) => {
    const audioPath = path.resolve(__dirname, "public", "cnu-audio", req.params.file);
    if (!fs.existsSync(audioPath)) return res.status(404).send("Not found");
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=86400");
    fs.createReadStream(audioPath).pipe(res);
  });


  // GET /office — Standalone admin office (separate login, own token, desktop-first)
  app.get('/office', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(getOfficeHtml());
  });

  app.get("/becky-admin", (_req, res) => {
    // Redirect to the React app's hash route which has the full admin panel with all tabs
    return res.redirect("/#/becky-admin");
    // Legacy server-rendered handler below (kept for reference)
    if (false) {
    const items = storage.getBeckyResponses();
    const themes = [...new Set(items.map((r: any) => r.theme))].sort();
    const themeLabels: Record<string, string> = {
      burnout: "Exhaustion / Burnout",
      family_stress: "Family Stress",
      difficult_family: "Difficult Family",
      client_decline: "Client Decline",
      personal_crisis: "Personal Crisis",
      lonely: "Feeling Lonely",
      unappreciated: "Unappreciated",
      general: "General",
    };

    const cards = items.map((item: any) => {
      const label = themeLabels[item.theme] || item.theme;
      const placeholder = item.isPlaceholder ? `<span class="badge placeholder">Needs Your Edit</span>` : `<span class="badge done">Your Response</span>`;
      return `
        <div class="card" id="card-${item.id}" data-theme="${item.theme}" data-id="${item.id}">
          <div class="card-header">
            <span class="theme-label">${label}</span>
            ${placeholder}
          </div>
          <div class="prompt-text" id="prompt-display-${item.id}">${escHtml(item.examplePrompt)}</div>
          <div class="response-label">BECKY'S RESPONSE</div>
          <div class="response-text" id="response-display-${item.id}">${escHtml(item.response)}</div>
          <div class="edit-form" id="edit-form-${item.id}" style="display:none">
            <label>Example Prompt</label>
            <textarea id="prompt-input-${item.id}" rows="2">${escHtml(item.examplePrompt)}</textarea>
            <label>Your Response</label>
            <textarea id="response-input-${item.id}" rows="6">${escHtml(item.response)}</textarea>
            <div class="form-actions">
              <button class="btn-save" data-action="save" data-id="${item.id}">Save</button>
              <button class="btn-cancel" data-action="cancel" data-id="${item.id}">Cancel</button>
            </div>
          </div>
          <div class="card-actions" id="actions-${item.id}">
            <button class="btn-edit" data-action="edit" data-id="${item.id}">✏ Write My Version</button>
            <button class="btn-delete" data-action="delete" data-id="${item.id}">Delete</button>
          </div>
          <div class="confirm-bar" id="confirm-${item.id}" style="display:none">
            <span class="confirm-msg">Delete this entry?</span>
            <div class="confirm-btns">
              <button class="btn-confirm-yes" data-action="delete-confirm" data-id="${item.id}">Yes, Delete</button>
              <button class="btn-confirm-no" data-action="delete-cancel" data-id="${item.id}">Cancel</button>
            </div>
          </div>
        </div>`;
    }).join("");

    const themeFilterBtns = [`<button class="filter-btn active" data-theme="">All Themes</button>`,
      ...themes.map((t: string) => `<button class="filter-btn" data-theme="${t}">${themeLabels[t] || t}</button>`)
    ].join("");

    const total = items.length;
    const needsEdit = items.filter((i: any) => i.isPlaceholder).length;
    const yours = total - needsEdit;

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Becky's Response Library</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a0a0d; color: #f0e6e8; min-height: 100vh; }
  header { background: #2d1018; border-bottom: 1px solid #4a1a24; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .logo { width: 36px; height: 36px; background: #8b1a2e; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
  .header-title { font-size: 17px; font-weight: 700; color: #f9d0d8; }
  .header-sub { font-size: 12px; color: #b06070; margin-top: 1px; }
  .header-count { font-size: 13px; color: #b06070; text-align: right; }
  .header-count strong { display: block; font-size: 22px; font-weight: 700; color: #f9d0d8; }
  .stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding: 16px 16px 0; }
  .stat { background: #2d1018; border-radius: 10px; padding: 14px; text-align: center; }
  .stat-num { font-size: 24px; font-weight: 700; }
  .stat-num.amber { color: #f59e0b; }
  .stat-num.green { color: #4ade80; }
  .stat-num.white { color: #f9d0d8; }
  .stat-label { font-size: 11px; color: #b06070; margin-top: 3px; }
  .notice { background: #2d1a00; border: 1px solid #92400e; border-radius: 10px; margin: 14px 16px 0; padding: 12px 14px; font-size: 13px; color: #fcd34d; }
  .notice p { color: #fde68a; font-size: 12px; margin-top: 4px; }
  .filters { display: flex; gap: 8px; padding: 14px 16px 0; overflow-x: auto; scrollbar-width: none; }
  .filters::-webkit-scrollbar { display: none; }
  .filter-btn { flex-shrink: 0; padding: 7px 14px; border-radius: 20px; border: 1px solid #4a1a24; background: transparent; color: #b06070; font-size: 13px; cursor: pointer; transition: all .2s; }
  .filter-btn.active { background: #8b1a2e; color: #fff; border-color: #8b1a2e; }
  .cards { padding: 14px 16px 100px; display: flex; flex-direction: column; gap: 12px; }
  .card { background: #2d1018; border-radius: 12px; padding: 16px; border: 1px solid #3d1520; }
  .card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
  .theme-label { font-size: 11px; font-weight: 600; color: #8b1a2e; text-transform: uppercase; letter-spacing: .06em; }
  .badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 12px; text-transform: uppercase; letter-spacing: .05em; }
  .badge.placeholder { background: #451a03; color: #f59e0b; border: 1px solid #92400e; }
  .badge.done { background: #052e16; color: #4ade80; border: 1px solid #166534; }
  .prompt-text { font-size: 13px; color: #c08090; font-style: italic; margin-bottom: 10px; line-height: 1.5; }
  .response-label { font-size: 10px; font-weight: 700; color: #8b1a2e; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
  .response-text { font-size: 14px; color: #f0e6e8; line-height: 1.65; }
  .edit-form label { display: block; font-size: 11px; font-weight: 600; color: #b06070; text-transform: uppercase; letter-spacing: .06em; margin: 12px 0 5px; }
  .edit-form textarea { width: 100%; background: #1a0a0d; border: 1px solid #4a1a24; border-radius: 8px; color: #f0e6e8; font-size: 14px; padding: 10px; resize: vertical; font-family: inherit; line-height: 1.6; }
  .edit-form textarea:focus { outline: none; border-color: #8b1a2e; }
  .form-actions { display: flex; gap: 8px; margin-top: 12px; }
  .btn-save { flex: 1; background: #8b1a2e; color: #fff; border: none; border-radius: 8px; padding: 11px; font-size: 14px; font-weight: 600; cursor: pointer; }
  .btn-cancel { padding: 11px 16px; background: transparent; border: 1px solid #4a1a24; color: #b06070; border-radius: 8px; font-size: 14px; cursor: pointer; }
  .card-actions { display: flex; gap: 8px; margin-top: 12px; }
  .btn-edit { flex: 1; background: #3d1520; color: #f9d0d8; border: 1px solid #4a1a24; border-radius: 8px; padding: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .btn-delete { padding: 10px 14px; background: transparent; border: 1px solid #4a1a24; color: #b06070; border-radius: 8px; font-size: 13px; cursor: pointer; }
  .confirm-bar { background: #3d0a12; border: 1px solid #8b1a2e; border-radius: 8px; padding: 10px 12px; margin-top: 8px; }
  .confirm-msg { font-size: 13px; color: #f9d0d8; display: block; margin-bottom: 8px; }
  .confirm-btns { display: flex; gap: 8px; }
  .btn-confirm-yes { flex: 1; background: #8b1a2e; color: #fff; border: none; border-radius: 8px; padding: 9px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .btn-confirm-no { padding: 9px 14px; background: transparent; border: 1px solid #4a1a24; color: #b06070; border-radius: 8px; font-size: 13px; cursor: pointer; }
  .add-section { position: fixed; bottom: 0; left: 0; right: 0; background: #2d1018; border-top: 1px solid #4a1a24; padding: 12px 16px; }
  .btn-add { width: 100%; background: #8b1a2e; color: #fff; border: none; border-radius: 10px; padding: 14px; font-size: 15px; font-weight: 700; cursor: pointer; }
  .add-modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.7); z-index: 50; align-items: flex-end; }
  .add-modal.open { display: flex; }
  .add-modal-inner { background: #2d1018; border-radius: 16px 16px 0 0; padding: 20px 16px 32px; width: 100%; border-top: 1px solid #4a1a24; }
  .add-modal-inner h2 { font-size: 17px; font-weight: 700; color: #f9d0d8; margin-bottom: 4px; }
  .add-modal-inner p { font-size: 13px; color: #b06070; margin-bottom: 16px; }
  .add-modal-inner label { display: block; font-size: 11px; font-weight: 600; color: #b06070; text-transform: uppercase; letter-spacing: .06em; margin: 12px 0 5px; }
  .add-modal-inner input, .add-modal-inner textarea, .add-modal-inner select { width: 100%; background: #1a0a0d; border: 1px solid #4a1a24; border-radius: 8px; color: #f0e6e8; font-size: 14px; padding: 10px; font-family: inherit; }
  .add-modal-inner select option { background: #2d1018; }
  .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #052e16; color: #4ade80; border: 1px solid #166534; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; z-index: 100; opacity: 0; transition: opacity .3s; pointer-events: none; }
  .toast.show { opacity: 1; }
  .hidden { display: none !important; }
</style>
</head>
<body>
<div class="toast" id="toast"></div>
<header>
  <div class="header-left">
    <div class="logo">📖</div>
    <div>
      <div class="header-title">Becky's Response Library</div>
      <div class="header-sub">Care Net — Admin</div>
    </div>
  </div>
  <div class="header-count"><strong>${total}</strong>total entries</div>
</header>
<div class="stats">
  <div class="stat"><div class="stat-num white">${total}</div><div class="stat-label">Total Entries</div></div>
  <div class="stat"><div class="stat-num amber">${needsEdit}</div><div class="stat-label">Need Your Edit</div></div>
  <div class="stat"><div class="stat-num green">${yours}</div><div class="stat-label">Your Responses</div></div>
</div>
${needsEdit > 0 ? `<div class="notice">⚠ ${needsEdit} placeholder entries need your voice<p>Tap "Write My Version" on any entry to replace it with your own words.</p></div>` : ""}
<div class="filters" id="filters">${themeFilterBtns}</div>
<div class="cards" id="cards">${cards}</div>
<div class="add-section">
  <button class="btn-add" id="btn-open-add">+ New Entry</button>
</div>
<div class="add-modal" id="add-modal">
  <div class="add-modal-inner">
    <h2>New Response</h2>
    <p>Write a new prompt and your authentic response.</p>
    <label>Theme</label>
    <select id="new-theme">
      ${themes.map((t: string) => `<option value="${t}">${themeLabels[t] || t}</option>`).join("")}
      <option value="new">+ New theme...</option>
    </select>
    <div id="new-theme-input-wrap" style="display:none;margin-top:8px">
      <input type="text" id="new-theme-input" placeholder="Theme name (e.g. grief)" />
    </div>
    <label>Example Prompt</label>
    <textarea id="new-prompt" rows="3" placeholder="What might a caregiver say or feel?"></textarea>
    <label>Your Response</label>
    <textarea id="new-response" rows="6" placeholder="Write in your own voice..."></textarea>
    <div class="form-actions" style="margin-top:16px">
      <button class="btn-save" id="btn-submit-new">Save Entry</button>
      <button class="btn-cancel" id="btn-close-add">Cancel</button>
    </div>
  </div>
</div>
<script src="becky-admin.js"></script>
</body></html>`);
    } // end if(false)
  });

  // Users
  // GET /api/users — scoped to the caller's care circle (auth required)
  app.get("/api/users", async (req: AuthRequest, res) => {
    const allUsers = storage.getUsers();
    try {
      const token = getTokenFromRequest(req as any);
      if (token) {
        const payload = await verifyJWT(token);
        if (payload) {
          const account = db.select().from(authAccounts).where(eq(authAccounts.id, payload.authAccountId)).get();
          if (account?.userId) {
            const me = allUsers.find(u => u.id === account.userId);
            if (me?.clientId) {
              return res.json(allUsers.filter(u => u.clientId === me.clientId));
            } else if (me) {
              return res.json([me]);
            }
          }
        }
      }
    } catch (_) { /* ignore */ }
    return res.status(401).json({ message: "Not authenticated" });
  });
  app.get("/api/users/:id", requireAuth, (req: AuthRequest, res) => {
    const user = storage.getUserById(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  });
  app.get("/api/clients/:clientId/family", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    res.json(storage.getUsersByClientId(Number(req.params.clientId)));
  });
  app.post("/api/users", requireAuth, (req: AuthRequest, res) => {
    const user = storage.createUser(req.body);
    res.status(201).json(user);
  });
  app.patch("/api/users/:id", requireAuth, (req: AuthRequest, res) => {
    const user = storage.updateUser(Number(req.params.id), req.body);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  });

  // Clients
  app.get("/api/clients", requireAuth, (_req: AuthRequest, res) => res.json(storage.getClients()));
  app.get("/api/clients/:id", requireAuth, requirePortalAccess(r => Number(r.params.id)), (req: AuthRequest, res) => {
    const client = storage.getClientById(Number(req.params.id));
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  });
  app.post("/api/clients", requireAuth, (req: AuthRequest, res) => {
    const client = storage.createClient(req.body);
    res.status(201).json(client);
  });
  app.patch("/api/clients/:id", requireAuth, (req: AuthRequest, res) => {
    const clientId = Number(req.params.id);
    const existingClient = storage.getClientById(clientId);
    const client = storage.updateClient(clientId, req.body);
    if (!client) return res.status(404).json({ message: "Client not found" });

    const now = new Date().toISOString();
    const updatingUser = storage.getUserById(req.authUserId!);
    const updaterName = updatingUser?.name ?? "Your Main Contact";

    // Fire Urgent in-app bell to all CGs when allergies change
    const oldAllergies = existingClient?.allergies ?? '[]';
    const newAllergies = req.body.allergies;
    if (newAllergies !== undefined && newAllergies !== oldAllergies) {
      const caregivers = storage.getCaregiversByClientId(clientId);
      caregivers.forEach(cg => {
        storage.createNotification({
          userId: cg.id,
          clientId,
          title: `⚠️ Allergy information updated`,
          body: `${updaterName} updated allergy information for your client. Please review before your next shift.`,
          type: 'alert',
          priority: 'urgent',
          isRead: false,
          createdAt: now,
          linkTo: '/client-portal',
        });
      });
    }

    // Fire Urgent in-app bell when primary condition changes
    const oldCondition = existingClient?.primaryCondition;
    const newCondition = req.body.primaryCondition;
    if (newCondition !== undefined && newCondition !== oldCondition) {
      const caregivers = storage.getCaregiversByClientId(clientId);
      caregivers.forEach(cg => {
        storage.createNotification({
          userId: cg.id,
          clientId,
          title: `📌 Primary condition updated`,
          body: `${updaterName} updated the primary condition for your client. Please review.`,
          type: 'alert',
          priority: 'urgent',
          isRead: false,
          createdAt: now,
          linkTo: '/client-portal',
        });
      });
    }

    res.json(client);
  });

  // --- Practice (Sample) Client routes ---

  // GET /api/clients/practice/:caregiverId — check if CG already has a practice client
  app.get("/api/clients/practice/:caregiverId", requireAuth, (req: AuthRequest, res) => {
    const caregiverId = Number(req.params.caregiverId);
    const existing = storage.getPracticeClientByCaregiverId(caregiverId);
    res.json(existing || null);
  });

  // POST /api/clients/practice — create a sample client for the logged-in CG (once only)
  app.post("/api/clients/practice", requireAuth, (req: AuthRequest, res) => {
    const caregiverId = req.authUserId!;
    const { dateOfBirth, primaryCondition } = req.body;
    if (!dateOfBirth || !primaryCondition) {
      return res.status(400).json({ message: "dateOfBirth and primaryCondition are required" });
    }
    // Enforce one sample client per CG
    const existing = storage.getPracticeClientByCaregiverId(caregiverId);
    if (existing) {
      return res.status(409).json({ message: "Sample client already exists", client: existing });
    }
    const client = storage.createPracticeClient(caregiverId, dateOfBirth, primaryCondition);
    // Only set clientId if CG has no real client yet — if they have a real one, sample stays dormant
    const cgUser = storage.getUserById(caregiverId);
    if (!cgUser?.clientId) {
      storage.updateUser(caregiverId, { clientId: client.id });
    }
    res.status(201).json(client);
  });

  // POST /api/clients/practice/switch-to-sample — CG switches active portal to sample client
  app.post("/api/clients/practice/switch-to-sample", requireAuth, (req: AuthRequest, res) => {
    const caregiverId = req.authUserId!;
    const cgUser = storage.getUserById(caregiverId);
    if (!cgUser?.sampleClientId) return res.status(404).json({ message: "No sample client found" });
    // Store the real clientId so we can switch back
    const realClientId = cgUser.clientId !== cgUser.sampleClientId ? cgUser.clientId : null;
    storage.updateUser(caregiverId, { clientId: cgUser.sampleClientId });
    res.json({ success: true, clientId: cgUser.sampleClientId, realClientId });
  });

  // POST /api/clients/practice/switch-to-real — CG switches back to real client
  app.post("/api/clients/practice/switch-to-real", requireAuth, (req: AuthRequest, res) => {
    const caregiverId = req.authUserId!;
    const { realClientId } = req.body;
    if (!realClientId) return res.status(400).json({ message: "realClientId required" });
    storage.updateUser(caregiverId, { clientId: realClientId });
    res.json({ success: true, clientId: realClientId });
  });

  // DELETE /api/clients/practice/:clientId — permanently delete the sample client
  app.delete("/api/clients/practice/:clientId", requireAuth, (req: AuthRequest, res) => {
    const clientId = Number(req.params.clientId);
    const client = storage.getClientById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });
    if (!client.isPractice) return res.status(403).json({ message: "Not a practice client" });
    if (client.caregiverId !== req.authUserId!) return res.status(403).json({ message: "Not your practice client" });
    const cgUser = storage.getUserById(req.authUserId!);
    // If CG is currently in sample mode, move them back to pre-connection
    if (cgUser?.clientId === clientId) {
      storage.updateUser(req.authUserId!, { clientId: null });
    }
    storage.deletePracticeClient(clientId);
    res.json({ success: true });
  });

  // PATCH /api/clients/practice/:clientId/showcase — toggle showcase flag
  app.patch("/api/clients/practice/:clientId/showcase", requireAuth, (req: AuthRequest, res) => {
    const clientId = Number(req.params.clientId);
    const client = storage.getClientById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });
    if (!client.isPractice) return res.status(403).json({ message: "Not a practice client" });
    if (client.caregiverId !== req.authUserId!) return res.status(403).json({ message: "Not your practice client" });
    const { isShowcase } = req.body;
    const updated = storage.setShowcase(clientId, !!isShowcase);
    res.json(updated);
  });

  // ── Client Empowerment Routes ──────────────────────────────────────────────

  // GET /api/clients/:id/client-portal-status — MC checks if client has a portal account
  app.get("/api/clients/:id/client-portal-status", requireAuth, (req: AuthRequest, res) => {
    const clientId = Number(req.params.id);
    const client = storage.getClientById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });
    if (!client.clientUserId) {
      return res.json({ hasPortalAccess: false, permissionLevel: null, userId: null });
    }
    const clientUser = storage.getUserById(client.clientUserId);
    return res.json({
      hasPortalAccess: true,
      permissionLevel: clientUser?.permissionLevel ?? "observer",
      userId: client.clientUserId,
      name: clientUser?.name ?? null,
    });
  });

  // PATCH /api/clients/:id/client-permission — MC upgrades client permission level
  app.patch("/api/clients/:id/client-permission", requireAuth, (req: AuthRequest, res) => {
    const clientId = Number(req.params.id);
    const client = storage.getClientById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });
    // Only MC (primary_family) for this client can upgrade permissions
    const requestingUser = storage.getUserById(req.authUserId!);
    if (requestingUser?.role !== "primary_family" || requestingUser?.clientId !== clientId) {
      return res.status(403).json({ message: "Only the Main Contact can manage client portal access" });
    }
    if (!client.clientUserId) {
      return res.status(400).json({ message: "Client does not have a portal account yet" });
    }
    const { level } = req.body;
    const validLevels = ["observer", "contributor", "self_care_mc"];
    if (!validLevels.includes(level)) {
      return res.status(400).json({ message: "Invalid permission level" });
    }
    const updated = storage.setClientPermissionLevel(client.clientUserId, level);
    res.json({ success: true, permissionLevel: updated?.permissionLevel });
  });

  // ── Phase 2: Minor approval toggle (MC sets requiresMinorApproval on client) ─────────────────
  app.patch("/api/clients/:id/minor-approval-toggle", requireAuth, (req: AuthRequest, res) => {
    const clientId = Number(req.params.id);
    const client = storage.getClientById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });
    const requestingUser = storage.getUserById(req.authUserId!);
    if (requestingUser?.role !== "primary_family" || requestingUser?.clientId !== clientId) {
      return res.status(403).json({ message: "Only the Main Contact can manage this setting" });
    }
    const { requiresMinorApproval } = req.body;
    const updated = storage.updateClient(clientId, { requiresMinorApproval: !!requiresMinorApproval });
    res.json({ success: true, requiresMinorApproval: updated?.requiresMinorApproval });
  });

  // ── Phase 2: Approve a pending-review activity log entry ────────────────────
  app.patch("/api/activity/:id/approve", requireAuth, (req: AuthRequest, res) => {
    const logId = Number(req.params.id);
    const log = storage.getActivityLogById(logId);
    if (!log) return res.status(404).json({ message: "Log not found" });
    const requestingUser = storage.getUserById(req.authUserId!);
    // Only MC for this client can approve
    if (requestingUser?.role !== "primary_family" || requestingUser?.clientId !== log.clientId) {
      return res.status(403).json({ message: "Only the Main Contact can approve entries" });
    }
    const updated = storage.updateActivityLog(logId, { pendingReview: false, approvedByUserId: req.authUserId! });
    res.json(updated);
  });

  // ── Phase 2: Approve a pending-review vitals entry ──────────────────────────
  app.patch("/api/vitals/:id/approve", requireAuth, (req: AuthRequest, res) => {
    const vitalId = Number(req.params.id);
    const record = storage.getVitalById(vitalId);
    if (!record) return res.status(404).json({ message: "Vital record not found" });
    const requestingUser = storage.getUserById(req.authUserId!);
    if (requestingUser?.role !== "primary_family" || requestingUser?.clientId !== record.clientId) {
      return res.status(403).json({ message: "Only the Main Contact can approve entries" });
    }
    const updated = storage.updateVital(vitalId, { pendingReview: false, approvedByUserId: req.authUserId! });
    res.json(updated);
  });

  // ── Phase 2: Dismiss contributor welcome banner ───────────────────────────
  app.patch("/api/users/me/contributor-welcome-seen", requireAuth, (req: AuthRequest, res) => {
    const updated = storage.updateUser(req.authUserId!, { contributorWelcomeSeen: true });
    res.json({ success: true, contributorWelcomeSeen: updated?.contributorWelcomeSeen });
  });

  app.patch("/api/users/me/seen-mc-invite", requireAuth, (req: AuthRequest, res) => {
    const updated = storage.updateUser(req.authUserId!, { hasSeenMcInvitePrompt: true });
    res.json({ success: true, hasSeenMcInvitePrompt: updated?.hasSeenMcInvitePrompt });
  });

  app.patch("/api/users/me/seen-high-five", requireAuth, (req: AuthRequest, res) => {
    sqlite.prepare(`UPDATE users SET has_seen_high_five = 1 WHERE id = ?`).run(req.authUserId!);
    res.json({ success: true });
  });

  app.patch("/api/users/me/seen-open-hand", requireAuth, (req: AuthRequest, res) => {
    sqlite.prepare(`UPDATE users SET has_seen_open_hand = 1 WHERE id = ?`).run(req.authUserId!);
    res.json({ success: true });
  });

  // ── Phase 3: Transfer of Care ────────────────────────────────────────────────

  // GET /api/clients/:id/transfer-status
  app.get("/api/clients/:id/transfer-status", requireAuth, (req: AuthRequest, res) => {
    const clientId = Number(req.params.id);
    const status = storage.getTransferStatus(clientId);
    if (!status) return res.status(404).json({ message: "Client not found" });
    // Auto-expire MC-initiated offer after 72 hours
    if (status.step === 1 && status.initiatedBy === 'mc' && status.offeredAt) {
      const offeredMs = new Date(status.offeredAt).getTime();
      const expiredMs = offeredMs + 72 * 60 * 60 * 1000;
      if (Date.now() > expiredMs) {
        storage.cancelTransfer(clientId);
        return res.json({ ...status, step: 0, expired: true });
      }
    }
    res.json(status);
  });

  // POST /api/clients/:id/transfer/initiate — MC sends "You Are Ready" OR client starts "I Am Ready"
  app.post("/api/clients/:id/transfer/initiate", requireAuth, async (req: AuthRequest, res) => {
    const clientId = Number(req.params.id);
    const client = storage.getClientById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });
    const requestingUser = storage.getUserById(req.authUserId!);
    if (!requestingUser) return res.status(401).json({ message: "Not authenticated" });

    const isMC = requestingUser.role === 'primary_family' && requestingUser.clientId === clientId;
    const isClient = requestingUser.role === 'self_care' && requestingUser.clientId === clientId
      && requestingUser.permissionLevel === 'contributor';

    if (!isMC && !isClient) {
      return res.status(403).json({ message: "Only the Main Contact or the client may initiate a Transfer of Care" });
    }
    if (!client.clientUserId) {
      return res.status(400).json({ message: "Client does not have a portal account" });
    }
    // Guard: client-initiated requires 18+
    if (isClient && client.dateOfBirth) {
      const dob = new Date(client.dateOfBirth);
      const ageDiff = Date.now() - dob.getTime();
      const ageYears = new Date(ageDiff).getUTCFullYear() - 1970;
      if (ageYears < 18) {
        return res.status(403).json({ message: "Client must be 18 or older to initiate a Transfer of Care" });
      }
    }
    if ((client.transferStep ?? 0) > 0 && !client.transferCancelledAt) {
      return res.status(400).json({ message: "A transfer is already in progress" });
    }

    const initiatedBy: 'mc' | 'client' = isMC ? 'mc' : 'client';
    const updated = storage.initiateTransfer(clientId, initiatedBy);

    // Notify the other party
    if (isMC && client.clientUserId) {
      const clientUser = storage.getUserById(client.clientUserId);
      const clientAccount = clientUser
        ? db.select().from(authAccounts).where(eq(authAccounts.userId, clientUser.id)).get()
        : null;
      // In-app notification
      storage.createNotification({
        userId: client.clientUserId,
        clientId,
        title: `${requestingUser.name} says you are ready`,
        body: `${requestingUser.name} has offered to transfer full ownership of your care portal to you. Open your portal to review and accept.`,
        type: 'alert',
        priority: 'urgent',
        isRead: false,
        createdAt: new Date().toISOString(),
        linkTo: '/dashboard',
      });
      // Email
      if (clientAccount?.email) {
        sendEmail({
          to: clientAccount.email,
          subject: `${requestingUser.name} says you are ready — Transfer of Care`,
          html: `<p>Hi ${clientUser?.name ?? 'there'},</p>
<p><strong>${requestingUser.name}</strong> has offered to transfer full ownership of your care record to you through Care Net Portal.</p>
<p>This means you would become the primary authority on your own care portal. ${requestingUser.name} would step into a supportive role.</p>
<p>To review and respond to this offer, sign in to your portal:</p>
<p><a href="${process.env.APP_URL || 'https://care-net-portal-production.up.railway.app'}">${process.env.APP_URL || 'https://care-net-portal-production.up.railway.app'}</a></p>
<p>This offer expires in 72 hours. If you're not ready, it will simply remain status quo — no pressure.</p>
<p style="color:#6b7280;font-size:12px;">Care Net Portal &mdash; <a href="https://carenetportal.com">carenetportal.com</a></p>`,
        }).catch(err => console.error('[transfer initiate email]', err));
      }
    } else if (isClient && client.primaryContactId) {
      // Notify MC that client started "I Am Ready"
      const mcUser = storage.getUserById(client.primaryContactId);
      const mcAccount = mcUser
        ? db.select().from(authAccounts).where(eq(authAccounts.userId, mcUser.id)).get()
        : null;
      storage.createNotification({
        userId: client.primaryContactId,
        clientId,
        title: `${requestingUser.name} has started a Transfer of Care`,
        body: `${requestingUser.name} has indicated they are ready to take ownership of their care portal. This is step 1 of 3. No action is required from you yet.`,
        type: 'alert',
        priority: 'urgent',
        isRead: false,
        createdAt: new Date().toISOString(),
        linkTo: '/client-portal',
      });
      if (mcAccount?.email) {
        sendEmail({
          to: mcAccount.email,
          subject: `${requestingUser.name} has started a Transfer of Care`,
          html: `<p>Hi ${mcUser?.name ?? 'there'},</p>
<p><strong>${requestingUser.name}</strong> has indicated they are ready to take ownership of their own care portal.</p>
<p>This is step 1 of 3. They will have a chance to confirm their decision over the next 48 hours before anything changes.</p>
<p>No action is required from you at this time. You will be notified at each step.</p>
<p>If you would like to co-confirm and allow the transfer to proceed immediately without the 48-hour wait, you can do so from the Client Profile page in your portal.</p>
<p><a href="${process.env.APP_URL || 'https://care-net-portal-production.up.railway.app'}">${process.env.APP_URL || 'https://care-net-portal-production.up.railway.app'}</a></p>
<p style="color:#6b7280;font-size:12px;">Care Net Portal &mdash; <a href="https://carenetportal.com">carenetportal.com</a></p>`,
        }).catch(err => console.error('[transfer initiate client email]', err));
      }
    }

    res.json({ success: true, client: updated });
  });

  // POST /api/clients/:id/transfer/advance — client advances to step 2 or 3 (client-initiated path)
  app.post("/api/clients/:id/transfer/advance", requireAuth, async (req: AuthRequest, res) => {
    const clientId = Number(req.params.id);
    const client = storage.getClientById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });
    const requestingUser = storage.getUserById(req.authUserId!);
    if (!requestingUser) return res.status(401).json({ message: "Not authenticated" });

    const isClient = requestingUser.role === 'self_care' && requestingUser.clientId === clientId;
    const isMCAccepting = requestingUser.role === 'primary_family' && requestingUser.clientId === clientId
      && client.transferInitiatedBy === 'mc' && (client.transferStep ?? 0) === 1;

    if (!isClient && !isMCAccepting) {
      return res.status(403).json({ message: "Not authorized to advance this transfer" });
    }
    if ((client.transferStep ?? 0) === 0) {
      return res.status(400).json({ message: "No transfer in progress" });
    }

    const currentStep = client.transferStep ?? 0;

    // MC-initiated path: client accepts at step 1 → check if MC co-confirmed (waive wait) or proceed directly
    if (isMCAccepting || (isClient && client.transferInitiatedBy === 'mc' && currentStep === 1)) {
      // Client is accepting the MC's offer — execute immediately
      const { mcPostTransferRole } = req.body;
      const validRoles = ['monitor', 'step_back', 'remove'];
      if (!validRoles.includes(mcPostTransferRole)) {
        return res.status(400).json({ message: "Please choose how the Main Contact should continue" });
      }
      const result = storage.executeTransfer(clientId, mcPostTransferRole);
      if (!result) return res.status(500).json({ message: "Transfer execution failed" });
      await sendTransferCompletionEmails(clientId, result.oldMcUser, result.clientUser, requestingUser, mcPostTransferRole);
      return res.json({ success: true, completed: true, mcPostTransferRole });
    }

    // Client-initiated path: advance step with time gates
    if (isClient && client.transferInitiatedBy === 'client') {
      if (currentStep === 1) {
        // Step 1 → 2: enforce 24-hour gate unless MC co-confirmed
        if (!client.transferMCCoConfirmed) {
          const initiated = client.ownershipTransferInitiatedAt
            ? new Date(client.ownershipTransferInitiatedAt).getTime()
            : 0;
          const hoursElapsed = (Date.now() - initiated) / (1000 * 60 * 60);
          if (hoursElapsed < 24) {
            return res.status(400).json({
              message: "Please take a day to reflect. You can confirm again in 24 hours.",
              hoursRemaining: Math.ceil(24 - hoursElapsed),
            });
          }
        }
        storage.advanceTransferStep(clientId, 2);
        // Notify MC of step 2
        if (client.primaryContactId) {
          const mcUser = storage.getUserById(client.primaryContactId);
          const mcAccount = mcUser
            ? db.select().from(authAccounts).where(eq(authAccounts.userId, mcUser.id)).get()
            : null;
          storage.createNotification({
            userId: client.primaryContactId,
            clientId,
            title: `${requestingUser.name} confirmed — step 2 of 3`,
            body: `${requestingUser.name} has reaffirmed their decision to take ownership of their care portal. One more confirmation step remains.`,
            type: 'alert',
            priority: 'urgent',
            isRead: false,
            createdAt: new Date().toISOString(),
            linkTo: '/client-portal',
          });
          if (mcAccount?.email) {
            sendEmail({
              to: mcAccount.email,
              subject: `${requestingUser.name} confirmed — step 2 of their Transfer of Care`,
              html: `<p>Hi ${mcUser?.name ?? 'there'},</p><p><strong>${requestingUser.name}</strong> has confirmed their intent to take ownership of their care portal (step 2 of 3). One final confirmation step remains, which they can complete tomorrow.</p><p>If you want to allow the transfer to proceed without the remaining wait, you can co-confirm from the Client Profile page in your portal.</p><p style="color:#6b7280;font-size:12px;">Care Net Portal</p>`,
            }).catch(err => console.error('[transfer step2 email]', err));
          }
        }
        return res.json({ success: true, step: 2 });
      }

      if (currentStep === 2) {
        // Step 2 → execute: enforce 24-hour gate from step2At unless MC co-confirmed
        if (!client.transferMCCoConfirmed) {
          const step2Ms = client.transferStep2At
            ? new Date(client.transferStep2At).getTime()
            : 0;
          const hoursElapsed = (Date.now() - step2Ms) / (1000 * 60 * 60);
          if (hoursElapsed < 24) {
            return res.status(400).json({
              message: "Almost there. You can complete your Transfer of Care tomorrow.",
              hoursRemaining: Math.ceil(24 - hoursElapsed),
            });
          }
        }
        // Execute
        const { mcPostTransferRole } = req.body;
        const validRoles = ['monitor', 'step_back', 'remove'];
        if (!validRoles.includes(mcPostTransferRole)) {
          return res.status(400).json({ message: "Please choose how the Main Contact should continue" });
        }
        const result = storage.executeTransfer(clientId, mcPostTransferRole);
        if (!result) return res.status(500).json({ message: "Transfer execution failed" });
        await sendTransferCompletionEmails(clientId, result.oldMcUser, result.clientUser, requestingUser, mcPostTransferRole);
        return res.json({ success: true, completed: true, mcPostTransferRole });
      }
    }

    return res.status(400).json({ message: "Unexpected transfer state" });
  });

  // POST /api/clients/:id/transfer/co-confirm — MC co-confirms to waive 48-hour wait (client-initiated path)
  app.post("/api/clients/:id/transfer/co-confirm", requireAuth, async (req: AuthRequest, res) => {
    const clientId = Number(req.params.id);
    const client = storage.getClientById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });
    const requestingUser = storage.getUserById(req.authUserId!);
    const isMC = requestingUser?.role === 'primary_family' && requestingUser?.clientId === clientId;
    if (!isMC) return res.status(403).json({ message: "Only the Main Contact can co-confirm a transfer" });
    if ((client.transferStep ?? 0) === 0) return res.status(400).json({ message: "No transfer in progress" });
    storage.mcCoConfirmTransfer(clientId);
    // Notify client that MC waived the wait
    if (client.clientUserId) {
      const clientUser = storage.getUserById(client.clientUserId);
      storage.createNotification({
        userId: client.clientUserId,
        clientId,
        title: `${requestingUser!.name} agrees — you can complete your transfer now`,
        body: `${requestingUser!.name} has co-confirmed your Transfer of Care. You may now complete the final step at any time.`,
        type: 'alert',
        priority: 'urgent',
        isRead: false,
        createdAt: new Date().toISOString(),
        linkTo: '/dashboard',
      });
    }
    res.json({ success: true });
  });

  // POST /api/clients/:id/transfer/cancel — either party cancels
  app.post("/api/clients/:id/transfer/cancel", requireAuth, async (req: AuthRequest, res) => {
    const clientId = Number(req.params.id);
    const client = storage.getClientById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });
    const requestingUser = storage.getUserById(req.authUserId!);
    const isMC = requestingUser?.role === 'primary_family' && requestingUser?.clientId === clientId;
    const isClientUser = requestingUser?.role === 'self_care' && requestingUser?.clientId === clientId;
    if (!isMC && !isClientUser) return res.status(403).json({ message: "Not authorized" });
    if ((client.transferStep ?? 0) === 0) return res.status(400).json({ message: "No transfer in progress" });
    storage.cancelTransfer(clientId);
    // Notify the other party
    const otherUserId = isMC ? client.clientUserId : client.primaryContactId;
    if (otherUserId) {
      storage.createNotification({
        userId: otherUserId,
        clientId,
        title: "Transfer of Care cancelled",
        body: `${requestingUser!.name} has cancelled the Transfer of Care. Everything remains as it is.`,
        type: 'info',
        priority: 'normal',
        isRead: false,
        createdAt: new Date().toISOString(),
        linkTo: isMC ? '/dashboard' : '/client-portal',
      });
    }
    res.json({ success: true });
  });

  // ── Phase 3 helper: send completion emails to both parties ───────────────────
  async function sendTransferCompletionEmails(
    clientId: number,
    oldMcUser: { id: number; name: string } | undefined,
    clientUser: { id: number; name: string } | undefined,
    requestingUser: { name: string },
    mcPostTransferRole: string
  ) {
    const roleLabel = mcPostTransferRole === 'monitor'
      ? 'will continue to monitor the portal'
      : mcPostTransferRole === 'step_back'
      ? 'will step back to a secondary family member role'
      : 'has been removed from the portal';

    // Email to new portal owner (client)
    if (clientUser) {
      const clientAccount = db.select().from(authAccounts).where(eq(authAccounts.userId, clientUser.id)).get();
      if (clientAccount?.email) {
        sendEmail({
          to: clientAccount.email,
          subject: "Your Transfer of Care is complete — you own your portal",
          html: `<p>Hi ${clientUser.name},</p>
<p>Your Transfer of Care is complete. You are now the primary authority on your own care portal.</p>
<p>${oldMcUser?.name ?? 'Your Main Contact'} ${roleLabel}.</p>
<p>Sign in to your portal to see your full record:</p>
<p><a href="${process.env.APP_URL || 'https://care-net-portal-production.up.railway.app'}">${process.env.APP_URL || 'https://care-net-portal-production.up.railway.app'}</a></p>
<p style="color:#6b7280;font-size:12px;">Care Net Portal &mdash; <a href="https://carenetportal.com">carenetportal.com</a></p>`,
        }).catch(err => console.error('[transfer complete client email]', err));
      }
      // In-app
      storage.createNotification({
        userId: clientUser.id,
        clientId,
        title: "Your Transfer of Care is complete",
        body: "You are now the primary authority on your own care portal.",
        type: 'alert',
        priority: 'urgent',
        isRead: false,
        createdAt: new Date().toISOString(),
        linkTo: '/dashboard',
      });
    }
    // Email to demoted MC
    if (oldMcUser) {
      const mcAccount = db.select().from(authAccounts).where(eq(authAccounts.userId, oldMcUser.id)).get();
      if (mcAccount?.email) {
        sendEmail({
          to: mcAccount.email,
          subject: "Transfer of Care complete — your role has changed",
          html: `<p>Hi ${oldMcUser.name},</p>
<p>The Transfer of Care for ${clientUser?.name ?? 'your care recipient'} is complete. They are now the primary authority on their own care portal.</p>
<p>Your new role: ${roleLabel}.</p>
<p>Sign in to your portal:</p>
<p><a href="${process.env.APP_URL || 'https://care-net-portal-production.up.railway.app'}">${process.env.APP_URL || 'https://care-net-portal-production.up.railway.app'}</a></p>
<p style="color:#6b7280;font-size:12px;">Care Net Portal &mdash; <a href="https://carenetportal.com">carenetportal.com</a></p>`,
        }).catch(err => console.error('[transfer complete mc email]', err));
      }
      // In-app
      storage.createNotification({
        userId: oldMcUser.id,
        clientId,
        title: `${clientUser?.name ?? 'Your care recipient'} now owns their portal`,
        body: `The Transfer of Care is complete. Your new role: ${roleLabel}.`,
        type: 'info',
        priority: 'normal',
        isRead: false,
        createdAt: new Date().toISOString(),
        linkTo: '/client-portal',
      });
    }
  }

  // Schedule Events
  app.get("/api/clients/:clientId/schedule", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    res.json(storage.getScheduleEventsByClient(Number(req.params.clientId)));
  });
  app.post("/api/clients/:clientId/schedule", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const clientId = Number(req.params.clientId);
    const event = storage.createScheduleEvent({ ...req.body, clientId });

    // If added by MC (primary_family), notify all caregivers for this client
    if (req.body.addedByRole === "primary_family") {
      const caregivers = storage.getCaregiversByClientId(clientId);
      const when = event.scheduledAt
        ? new Date(event.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        : "(time TBD)";
      caregivers.forEach(cg => {
        storage.createNotification({
          userId: cg.id,
          clientId,
          title: "📅 New Appointment Added by Family",
          body: `"${event.title}" has been added to the schedule for ${when}. Please review.`,
          type: "alert",
          priority: 'urgent',
          isRead: false,
          createdAt: new Date().toISOString(),
          linkTo: "/schedule",
        });
      });
    }

    res.status(201).json(event);
  });
  app.patch("/api/schedule/:id", requireAuth, async (req: AuthRequest, res) => {
    const existing = storage.getScheduleEventById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Event not found" });
    const allowed = await checkPortalAccess(req, existing.clientId);
    if (!allowed) return res.status(403).json({ message: "Access denied" });
    const event = storage.updateScheduleEvent(Number(req.params.id), req.body);
    res.json(event);
  });
  app.delete("/api/schedule/:id", requireAuth, async (req: AuthRequest, res) => {
    const existing = storage.getScheduleEventById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Event not found" });
    const allowed = await checkPortalAccess(req, existing.clientId);
    if (!allowed) return res.status(403).json({ message: "Access denied" });
    storage.deleteScheduleEvent(Number(req.params.id));
    res.json({ success: true });
  });

  // Activity Logs
  app.get("/api/clients/:clientId/activity", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    res.json(storage.getActivityLogsByClient(Number(req.params.clientId)));
  });

  // GET /api/clients/:clientId/activity/search?q=fall
  // Full-text search across title, description, notes, category, emergencyType
  app.get("/api/clients/:clientId/activity/search", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const clientId = Number(req.params.clientId);
    const q = ((req.query.q as string) || "").trim().toLowerCase();
    if (!q || q.length < 2) return res.json([]);

    const all = storage.getActivityLogsByClient(clientId);
    const results = all.filter(log => {
      const haystack = [
        log.title,
        log.description,
        log.notes,
        log.category,
        log.emergencyType,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });

    // Enrich with logger name
    const enriched = results.map(log => {
      const logger = db.select({ name: users.name, role: users.role })
        .from(users).where(eq(users.id, log.loggedByUserId)).get();
      return { ...log, loggedByName: logger?.name ?? "Unknown", loggedByRole: log.loggedByRole ?? logger?.role };
    });

    res.json(enriched);
  });
  app.post("/api/clients/:clientId/activity", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), async (req: AuthRequest, res) => {
    const clientId = Number(req.params.clientId);
    const data = { ...req.body, clientId };

    // Auto-detect late entry
    if (data.scheduledAt && data.loggedAt) {
      const diffMinutes = (new Date(data.loggedAt).getTime() - new Date(data.scheduledAt).getTime()) / 60000;
      if (diffMinutes > 60) data.isLateEntry = true;
    }

    // ── Off-shift / family entry logic ─────────────────────────────────
    const isFamilyEntry = data.loggedByRole === "primary_family" || data.loggedByRole === "secondary_family";

    // Detect off-shift: no caregiver has an active shift for this client
    if (isFamilyEntry) {
      const caregivers = storage.getCaregiversByClientId(clientId);
      const anyOnShift = caregivers.some(cg => !!storage.getActiveShift(cg.id, clientId));
      if (!anyOnShift) data.isOffShiftEntry = true;
    }

    // ── Phase 2: self_care contributor — set pendingReview if client is minor w/ approval on ──
    if (data.loggedByRole === "self_care") {
      const clientRecord = storage.getClientById(clientId);
      if (clientRecord?.requiresMinorApproval) {
        data.pendingReview = true;
      }
    }

    const log = storage.createActivityLog(data);
    const now = new Date().toISOString();

    // ── Alert caregivers on family entries ───────────────────────────────
    if (isFamilyEntry) {
      const caregivers = storage.getCaregiversByClientId(clientId);

      if (data.isEmergency) {
        // ─ Tier 3: Emergency (ER / hospital admission) — urgent red notification + auto-thread
        caregivers.forEach(cg => {
          storage.createNotification({
            userId: cg.id,
            clientId,
            title: `🚨 EMERGENCY: ${log.title}`,
            body: `Family reported an emergency for your client${log.description ? ': ' + log.description.slice(0, 120) : ''}. Immediate attention may be required.`,
            type: "alert",
            priority: 'urgent',
            isRead: false,
            createdAt: now,
            linkTo: "/activity",
          });
        });
        // Auto-create an urgent message thread so caregiver can respond
        try {
          const threadRes = await storage.createChatThread({
            clientId,
            name: `🚨 Emergency: ${log.title}`,
            members: JSON.stringify([data.loggedByUserId, ...caregivers.map(c => c.id)]),
            createdByUserId: data.loggedByUserId,
            isOpen: true,
            createdAt: now,
          });
          await storage.createMessage({
            threadId: threadRes.id,
            senderId: data.loggedByUserId,
            content: `🚨 Emergency log entry filed.\n\n"${log.title}"${log.description ? '\n\n' + log.description : ''}\n\nLogged at: ${new Date(log.loggedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. Please respond when available.`,
            messageType: "text",
            priority: 'urgent',
            sentAt: now,
            isRead: false,
            readByUserIds: JSON.stringify([data.loggedByUserId]),
          });
        } catch (e) { console.error("Emergency thread creation failed", e); }

      } else if (data.isOffShiftEntry) {
        // ─ Tier 2: Off-shift family entry — red notification
        caregivers.forEach(cg => {
          storage.createNotification({
            userId: cg.id,
            clientId,
            title: `📄 Off-Shift Entry: ${log.title}`,
            body: `Family logged an entry while you were off-shift${log.description ? ': ' + log.description.slice(0, 120) : ''}. Please review.`,
            type: "alert",
            priority: 'urgent',
            isRead: false,
            createdAt: now,
            linkTo: "/activity",
          });
        });

      } else {
        // ─ Tier 1: Family entry while caregiver is on-shift — yellow notification
        caregivers.forEach(cg => {
          storage.createNotification({
            userId: cg.id,
            clientId,
            title: `📝 Family Added a Log Entry`,
            body: `"${log.title}" was added by family while you are on shift. Please review.`,
            type: "alert",
            priority: 'important',
            isRead: false,
            createdAt: now,
            linkTo: "/activity",
          });
        });
      }
    }

    // ── Notify MC when caregiver posts a care log entry ────────────────
    if (!isFamilyEntry) {
      try {
        const allPortalUsers = storage.getUsersByClientId(clientId);
        const mcUsers = allPortalUsers.filter(u => u.role === "primary_family");
        const posterName = data.loggedByName || "Your caregiver";
        mcUsers.forEach(mc => {
          try {
            const raw = (mc as any).notificationPrefs;
            const prefs: Record<string, boolean> = raw ? JSON.parse(raw) : {};
            // Notify if care_log_entries is explicitly true, OR if no prefs set yet (default on)
            const wantsNotif = prefs.care_log_entries !== false;
            if (wantsNotif) {
              storage.createNotification({
                userId: mc.id,
                clientId,
                title: `📋 New Care Log Entry`,
                body: `${posterName} posted "${log.title}"${log.description ? ": " + log.description.slice(0, 100) : ""}.`,
                type: "info",
                priority: "normal",
                isRead: false,
                createdAt: now,
                linkTo: "/activity",
              });
            }
          } catch (e) { console.error("[notify-mc] per-user error:", e); }
        });
      } catch (e) { console.error("[notify-mc] failed:", e); }
    }

    // ── Auto-tag for pattern recognition ────────────────────────────────
    const textToTag = [log.title, log.description, log.notes].filter(Boolean).join(" ");
    if (textToTag.length > 3) {
      try {
        saveTagsForEntry(clientId, "activity_log", log.id, log.loggedAt, textToTag);
      } catch (e) { console.error("[PatternEngine] Tagging failed", e); }
    }

    res.status(201).json(log);
  });
  app.patch("/api/activity/:id", requireAuth, (req: AuthRequest, res) => {
    const existing = storage.getActivityLogById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Log not found" });
    if (!checkPortalAccess(req, existing.clientId)) return res.status(403).json({ message: "Access denied" });
    const log = storage.updateActivityLog(Number(req.params.id), req.body);
    res.json(log);
  });
  app.post("/api/activity/:id/excuse", requireAuth, (req: AuthRequest, res) => {
    const { excuseNote, excusedByUserId } = req.body;
    if (!excuseNote || !excusedByUserId) return res.status(400).json({ message: "excuseNote and excusedByUserId required" });
    const log = storage.excuseActivityLog(Number(req.params.id), excuseNote, Number(excusedByUserId));
    if (!log) return res.status(404).json({ message: "Log not found" });
    res.json(log);
  });
  app.delete("/api/activity/:id", requireAuth, (req: AuthRequest, res) => {
    const existing = storage.getActivityLogById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Log not found" });
    if (!checkPortalAccess(req, existing.clientId)) return res.status(403).json({ message: "Access denied" });
    storage.deleteActivityLog(Number(req.params.id));
    res.json({ success: true });
  });

  // Care Log Addendums
  app.get("/api/activity/:id/addendums", requireAuth, (req: AuthRequest, res) => {
    const log = storage.getActivityLogById(Number(req.params.id));
    if (!log) return res.status(404).json({ message: "Log not found" });
    if (!checkPortalAccess(req, log.clientId)) return res.status(403).json({ message: "Access denied" });
    res.json(storage.getAddendumsByActivityLog(Number(req.params.id)));
  });

  app.post("/api/activity/:id/addendums", requireAuth, (req: AuthRequest, res) => {
    const log = storage.getActivityLogById(Number(req.params.id));
    if (!log) return res.status(404).json({ message: "Log not found" });
    if (!checkPortalAccess(req, log.clientId)) return res.status(403).json({ message: "Access denied" });
    // Only the original author can add an addendum
    if (log.loggedByUserId !== req.authUserId) return res.status(403).json({ message: "Only the original author can add an addendum" });
    const { tag, note } = req.body;
    if (!tag || !note?.trim()) return res.status(400).json({ message: "tag and note are required" });
    const VALID_TAGS = ["typo", "incomplete", "wrong_data", "additional_detail", "timing_correction"];
    if (!VALID_TAGS.includes(tag)) return res.status(400).json({ message: "Invalid tag" });
    const addendum = storage.createAddendum({
      activityLogId: Number(req.params.id),
      authorUserId: req.authUserId!,
      tag,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(addendum);
  });

  // Chat Threads
  app.get("/api/clients/:clientId/threads", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    res.json(storage.getChatThreadsByClient(Number(req.params.clientId)));
  });
  app.post("/api/clients/:clientId/threads", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const thread = storage.createChatThread({ ...req.body, clientId: Number(req.params.clientId) });
    res.status(201).json(thread);
  });
  app.patch("/api/threads/:id", requireAuth, (req: AuthRequest, res) => {
    const existing = storage.getChatThreadById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Thread not found" });
    if (!checkPortalAccess(req, existing.clientId)) return res.status(403).json({ message: "Access denied" });
    const thread = storage.updateChatThread(Number(req.params.id), req.body);
    res.json(thread);
  });

  // Thread member management
  app.patch("/api/threads/:id/members/add", requireAuth, (req: AuthRequest, res) => {
    const thread = storage.getChatThreadById(Number(req.params.id));
    if (!thread) return res.status(404).json({ message: "Thread not found" });
    if (!checkPortalAccess(req, thread.clientId)) return res.status(403).json({ message: "Access denied" });
    const current: number[] = JSON.parse(thread.members || "[]");
    const { userId } = req.body;
    if (!current.includes(userId)) current.push(userId);
    const updated = storage.updateChatThread(Number(req.params.id), { members: JSON.stringify(current) });
    res.json(updated);
  });

  app.patch("/api/threads/:id/members/remove", requireAuth, (req: AuthRequest, res) => {
    const thread = storage.getChatThreadById(Number(req.params.id));
    if (!thread) return res.status(404).json({ message: "Thread not found" });
    if (!checkPortalAccess(req, thread.clientId)) return res.status(403).json({ message: "Access denied" });
    const current: number[] = JSON.parse(thread.members || "[]");
    const { userId } = req.body;
    const updated = storage.updateChatThread(Number(req.params.id), { members: JSON.stringify(current.filter(id => id !== userId)) });
    res.json(updated);
  });

  // Messages
  app.get("/api/threads/:threadId/messages", requireAuth, (req: AuthRequest, res) => {
    res.json(storage.getMessagesByThread(Number(req.params.threadId)));
  });
  app.post("/api/threads/:threadId/messages", requireAuth, (req: AuthRequest, res) => {
    const msg = storage.createMessage({ ...req.body, threadId: Number(req.params.threadId) });
    res.status(201).json(msg);
  });
  app.patch("/api/messages/:id/read", requireAuth, (req: AuthRequest, res) => {
    const existing = storage.getMessageById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Message not found" });
    const thread = storage.getChatThreadById(existing.threadId);
    if (!thread) return res.status(404).json({ message: "Thread not found" });
    if (!checkPortalAccess(req, thread.clientId)) return res.status(403).json({ message: "Access denied" });
    const { userId } = req.body;
    const msg = storage.markMessageRead(Number(req.params.id), userId);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    res.json(msg);
  });

  // Caregiver profiles
  app.get("/api/clients/:clientId/caregivers", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    res.json(storage.getCaregiversByClientId(Number(req.params.clientId)));
  });

  // Media
  app.get("/api/clients/:clientId/media", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    res.json(storage.getMediaByClient(Number(req.params.clientId)));
  });
  app.post("/api/clients/:clientId/media", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const item = storage.createMediaItem({ ...req.body, clientId: Number(req.params.clientId) });
    res.status(201).json(item);
  });
  app.delete("/api/media/:id", requireAuth, (req: AuthRequest, res) => {
    const existing = storage.getMediaItemById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Media not found" });
    if (!checkPortalAccess(req, existing.clientId)) return res.status(403).json({ message: "Access denied" });
    storage.deleteMediaItem(Number(req.params.id));
    res.json({ success: true });
  });

  // Notifications
  app.get("/api/users/:userId/notifications", requireAuth, (req: AuthRequest, res) => {
    res.json(storage.getNotificationsByUser(Number(req.params.userId)));
  });
  app.patch("/api/notifications/:id/read", requireAuth, (req: AuthRequest, res) => {
    storage.markNotificationRead(Number(req.params.id));
    res.json({ success: true });
  });
  app.patch("/api/users/:userId/notifications/read-all", requireAuth, (req: AuthRequest, res) => {
    storage.markAllNotificationsRead(Number(req.params.userId));
    res.json({ success: true });
  });

  // ── Emergency SOS ──────────────────────────────────────────────────────────
  // POST /api/clients/:clientId/sos — trigger an emergency alert
  // smsToMc / smsToCg: whether to (stub) send SMS. In-app bell always fires for both.
  app.post("/api/clients/:clientId/sos", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    try {
      const clientId = Number(req.params.clientId);
      const { message = "Emergency — immediate attention needed", smsToMc = true, smsToCg = false } = req.body;
      const triggeredByUserId = req.authUserId!;
      const now = new Date().toISOString();

      const client = storage.getClientById(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const triggeringUser = storage.getUserById(triggeredByUserId);
      const triggerName = triggeringUser?.name ?? "A team member";
      const isCG = triggeringUser && ['caregiver','temp_caregiver','multi_caregiver'].includes(triggeringUser.role);
      const isMC = triggeringUser?.role === 'primary_family';

      // Create the alert log
      const alert = storage.createEmergencyAlert({
        clientId,
        triggeredByUserId,
        message,
        smsToMc: isCG ? true : smsToMc,  // CG always sends SMS to MC
        smsToCg: isMC ? smsToCg : false,
        smsSent: false, // stub — Twilio not yet connected
        reminderSent: false,
        createdAt: now,
      });

      // --- In-app bell: ALWAYS notify MC ---
      if (client.primaryContactId) {
        storage.createNotification({
          userId: client.primaryContactId,
          clientId,
          title: `🚨 Emergency Alert from ${triggerName}`,
          body: message,
          type: 'alert',
          priority: 'emergency',
          isRead: false,
          createdAt: now,
          linkTo: '/',
        });
      }

      // --- In-app bell: ALWAYS notify all CGs ---
      const caregivers = storage.getCaregiversByClientId(clientId);
      caregivers.forEach(cg => {
        if (cg.id === triggeredByUserId) return; // don't notify self
        storage.createNotification({
          userId: cg.id,
          clientId,
          title: `🚨 Emergency Alert from ${triggerName}`,
          body: message,
          type: 'alert',
          priority: 'emergency',
          isRead: false,
          createdAt: now,
          linkTo: '/',
        });
      });

      // --- Stub SMS log (Twilio wires in here later) ---
      // TODO: if (smsToCg && cgPhone) await twilioClient.messages.create({...})
      // TODO: if (smsToMc && mcPhone) await twilioClient.messages.create({...})
      console.log(`[SOS STUB] Emergency alert triggered for client ${clientId} by user ${triggeredByUserId}. smsToMc=${isCG ? true : smsToMc}, smsToCg=${isMC ? smsToCg : false}`);

      // --- If MC chose NOT to include CG in SMS, queue a reminder ---
      if (isMC && !smsToCg) {
        // Schedule a 2-hour in-app reminder to MC
        const reminderTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        // Store alert id so cron/polling can send it — we use a lightweight approach:
        // The reminder is sent when MC next loads notifications if 2h have passed
        // (full cron approach is Phase 2; for now we tag it in the alert record)
      }

      res.json({ success: true, alertId: alert.id, smsSent: false, smsStubbed: true });
    } catch (err: any) {
      console.error('[SOS] Error:', err);
      res.status(500).json({ message: 'Failed to send emergency alert' });
    }
  });

  // GET /api/clients/:clientId/sos — get emergency alert history
  app.get("/api/clients/:clientId/sos", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const alerts = storage.getEmergencyAlertsByClient(Number(req.params.clientId));
    res.json(alerts);
  });

  // GET /api/notifications/pending-sos-reminder — check if MC has unseen SOS reminder
  // Called when MC loads their notifications; sends in-app reminder if 2h elapsed
  app.get("/api/notifications/pending-sos-reminder", requireAuth, (req: AuthRequest, res) => {
    try {
      const userId = req.authUserId!;
      const user = storage.getUserById(userId);
      if (!user?.clientId || user.role !== 'primary_family') return res.json({ hasReminder: false });

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const alerts = storage.getEmergencyAlertsByClient(user.clientId);
      const pendingReminders = alerts.filter(a =>
        a.triggeredByUserId === userId &&
        !a.smsToCg &&
        !a.reminderSent &&
        a.createdAt < twoHoursAgo
      );

      if (pendingReminders.length > 0) {
        const now = new Date().toISOString();
        pendingReminders.forEach(a => {
          storage.markReminderSent(a.id);
          storage.createNotification({
            userId,
            clientId: a.clientId,
            title: "Did your caregiver get the update?",
            body: "You sent an emergency alert earlier. It may be helpful to let your caregiver know what happened.",
            type: 'alert',
            priority: 'important',
            isRead: false,
            createdAt: now,
            linkTo: '/messages',
          });
        });
        return res.json({ hasReminder: true, count: pendingReminders.length });
      }

      res.json({ hasReminder: false });
    } catch (err: any) {
      res.status(500).json({ message: 'Failed to check reminder' });
    }
  });

  // Archive Summaries
  app.get("/api/clients/:clientId/archive", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    res.json(storage.getArchiveSummariesByClient(Number(req.params.clientId)));
  });
  app.post("/api/clients/:clientId/archive", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const summary = storage.createArchiveSummary({ ...req.body, clientId: Number(req.params.clientId) });
    res.status(201).json(summary);
  });

  // Misc Notes
  app.get("/api/clients/:clientId/notes", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    res.json(storage.getMiscNotesByClient(Number(req.params.clientId)));
  });
  app.post("/api/clients/:clientId/notes", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const note = storage.createMiscNote({ ...req.body, clientId: Number(req.params.clientId) });
    res.status(201).json(note);
  });
  app.patch("/api/notes/:id", requireAuth, (req: AuthRequest, res) => {
    const existing = storage.getMiscNoteById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Note not found" });
    if (!checkPortalAccess(req, existing.clientId)) return res.status(403).json({ message: "Access denied" });
    const note = storage.updateMiscNote(Number(req.params.id), req.body);
    res.json(note);
  });
  app.delete("/api/notes/:id", requireAuth, (req: AuthRequest, res) => {
    const existing = storage.getMiscNoteById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Note not found" });
    if (!checkPortalAccess(req, existing.clientId)) return res.status(403).json({ message: "Access denied" });
    storage.deleteMiscNote(Number(req.params.id));
    res.json({ success: true });
  });

  // Documents
  app.get("/api/clients/:clientId/documents", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    res.json(storage.getDocumentsByClient(Number(req.params.clientId)));
  });
  app.post("/api/clients/:clientId/documents", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const doc = storage.createDocument({ ...req.body, clientId: Number(req.params.clientId) });
    res.status(201).json(doc);
  });
  app.delete("/api/documents/:id", requireAuth, (req: AuthRequest, res) => {
    const existing = storage.getDocumentById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Document not found" });
    if (!checkPortalAccess(req, existing.clientId)) return res.status(403).json({ message: "Access denied" });
    storage.deleteDocument(Number(req.params.id));
    res.json({ success: true });
  });
  // Update CG access level for a document (MC only)
  app.patch("/api/documents/:id/access", requireAuth, (req: AuthRequest, res) => {
    const existing = storage.getDocumentById(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Document not found" });
    if (!checkPortalAccess(req, existing.clientId)) return res.status(403).json({ message: "Access denied" });
    const { cgAccess } = req.body as { cgAccess: string };
    if (!["none", "read", "full"].includes(cgAccess)) {
      return res.status(400).json({ error: "Invalid cgAccess value" });
    }
    const updated = storage.updateDocumentAccess(Number(req.params.id), cgAccess);
    res.json(updated);
  });
  // Log a CG access event and notify MC
  app.post("/api/documents/:id/access-log", requireAuth, async (req: AuthRequest, res) => {
    const docId = Number(req.params.id);
    const userId = req.authUserId!;
    const { action } = req.body as { action: string };
    if (!["view", "download"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }
    const logEntry = storage.logDocumentAccess(docId, userId, action);
    // Get doc title + find MC for notification
    try {
      const doc = db.select().from(documents).where(eq(documents.id, docId)).get();
      const accessor = db.select().from(users).where(eq(users.id, userId)).get();
      if (doc && accessor) {
        // Find primary_family for this client
        const mcUser = db.select().from(users).where(and(eq(users.clientId, doc.clientId), eq(users.role, "primary_family"))).get();
        if (mcUser) {
          const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          storage.createNotification({
            userId: mcUser.id,
            type: "document_access",
            title: "Document Accessed",
            body: `${accessor.name} ${action === "download" ? "downloaded" : "viewed"} "${doc.title}" at ${timeStr}`,
            relatedId: docId,
            isRead: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch {}
    res.json(logEntry);
  });
  // Get access log for a document (MC only)
  app.get("/api/documents/:id/access-log", (req, res) => {
    res.json(storage.getDocumentAccessLog(Number(req.params.id)));
  });

  // POST /api/admin/users/:id/set-password — force-set password for any real user (admin only)
  app.post("/api/admin/users/:id/set-password", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const userId = Number(req.params.id);
    const { password } = req.body;
    if (!userId || userId <= 5) return res.status(400).json({ message: "Cannot modify demo/seed users." });
    if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
    try {
      const account = db.select().from(authAccounts).where(eq(authAccounts.userId, userId)).get();
      if (!account) return res.status(404).json({ message: "Auth account not found for that user." });
      const { hashPassword } = await import("./auth");
      const hashed = await hashPassword(password);
      db.update(authAccounts).set({ passwordHash: hashed }).where(eq(authAccounts.id, account.id)).run();
      res.json({ success: true, message: `Password updated for user ${userId} (${account.email})` });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to set password" });
    }
  });

  // DELETE /api/admin/users/:id — full account wipe (admin only)
  // Removes: users row, auth_accounts, auth_sessions, notifications, badge data,
  // connection invites, beta application — leaves client-side care data intact
  // (use /api/admin/beta-cleanup/wipe first if you want care data gone too)
  app.delete("/api/admin/users/:id", requireAuth, requireAdmin, (req: AuthRequest, res) => {
    const userId = Number(req.params.id);
    if (!userId || userId <= 5) {
      return res.status(400).json({ message: "Cannot delete demo/seed users (id 1–5)." });
    }
    try {
      const user = db.select().from(users).where(eq(users.id, userId)).get();
      if (!user) return res.status(404).json({ message: "User not found" });
      const authAccount = db.select().from(authAccounts).where(eq(authAccounts.userId, userId)).get();
      // 1. Revoke + delete all sessions
      if (authAccount) {
        db.delete(authSessions).where(eq(authSessions.authAccountId, authAccount.id)).run();
      }
      // 2. Delete auth account
      if (authAccount) {
        db.delete(authAccounts).where(eq(authAccounts.id, authAccount.id)).run();
      }
      // 3. Delete beta application by email
      if (authAccount?.email) {
        db.delete(betaApplications).where(eq(betaApplications.email, authAccount.email)).run();
      }
      // Use raw SQLite for all deletes to avoid Drizzle column-mapping issues on older DB schemas
      const safeDelete = (table: string, col: string) => {
        try { sqlite.prepare(`DELETE FROM ${table} WHERE ${col} = ?`).run(userId); } catch { /* column may not exist */ }
      };
      safeDelete('notifications', 'user_id');
      safeDelete('badge_surveys', 'submitted_by_user_id');
      safeDelete('badge_scores', 'user_id');
      safeDelete('connection_invites', 'sender_user_id');
      safeDelete('connection_invites', 'accepted_by_user_id');
      safeDelete('university_progress', 'user_id');
      safeDelete('wellbeing_check_ins', 'user_id');
      safeDelete('shifts', 'caregiver_id');
      safeDelete('caregiver_profiles', 'user_id');
      // If MC, clean up orphaned client portal
      if (user.role === 'primary_family' && user.clientId) {
        const remaining = sqlite.prepare(`SELECT id FROM users WHERE client_id = ? AND id != ?`).all(user.clientId, userId);
        if (remaining.length === 0) {
          sqlite.prepare(`DELETE FROM clients WHERE id = ?`).run(user.clientId);
        } else {
          sqlite.prepare(`UPDATE clients SET primary_contact_id = NULL WHERE id = ? AND primary_contact_id = ?`).run(user.clientId, userId);
        }
      }
      // Finally delete the user row itself
      sqlite.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
      res.json({ success: true, deletedUserId: userId, email: authAccount?.email ?? null });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // Outings
  app.get("/api/clients/:clientId/outings", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    res.json(storage.getOutingsByClient(Number(req.params.clientId)));
  });
  app.get("/api/clients/:clientId/outings/active", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const active = storage.getActiveOutingByClient(Number(req.params.clientId));
    res.json(active || null);
  });
  app.post("/api/clients/:clientId/outings", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const outing = storage.createOuting({ ...req.body, clientId: Number(req.params.clientId) });
    res.status(201).json(outing);
  });
  app.patch("/api/outings/:id", requireAuth, (req: AuthRequest, res) => {
    const existing = storage.getOutingById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Outing not found" });
    if (!checkPortalAccess(req, existing.clientId)) return res.status(403).json({ message: "Access denied" });
    const outing = storage.updateOuting(Number(req.params.id), req.body);
    res.json(outing);
  });

  // Notifications (create)
  app.post("/api/notifications", requireAuth, (req: AuthRequest, res) => {
    const notification = storage.createNotification(req.body);
    res.status(201).json(notification);
  });

  // Shifts — clock in/out
  app.get("/api/caregivers/:caregiverId/shifts", (req, res) => {
    res.json(storage.getShiftsByCaregiver(Number(req.params.caregiverId)));
  });
  app.get("/api/caregivers/:caregiverId/clients/:clientId/shift/active", (req, res) => {
    const shift = storage.getActiveShift(Number(req.params.caregiverId), Number(req.params.clientId));
    res.json(shift || null);
  });
  app.post("/api/caregivers/:caregiverId/clients/:clientId/shift/clockin", requireAuth, (req: AuthRequest, res) => {
    // Prevent double clock-in
    const existing = storage.getActiveShift(Number(req.params.caregiverId), Number(req.params.clientId));
    if (existing) return res.status(409).json({ message: "Already clocked in", shift: existing });
    const shift = storage.clockIn(Number(req.params.caregiverId), Number(req.params.clientId));
    res.status(201).json(shift);
  });
  app.post("/api/shifts/:shiftId/clockout", requireAuth, (req: AuthRequest, res) => {
    const shift = storage.clockOut(Number(req.params.shiftId));
    if (!shift) return res.status(404).json({ message: "Shift not found" });
    res.json(shift);
  });

  // ── Care Directory ─────────────────────────────────────────────────────────
  // GET all entries for a client
  app.get("/api/clients/:clientId/directory", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const clientId = Number(req.params.clientId);
    const entries = db.select().from(careDirectoryEntries)
      .where(eq(careDirectoryEntries.clientId, clientId))
      .all();
    res.json(entries);
  });

  // POST create entry (MC only)
  app.post("/api/clients/:clientId/directory", requireAuth, (req: AuthRequest, res) => {
    if (req.authUserRole !== "primary_family") return res.status(403).json({ message: "MC only" });
    const clientId = Number(req.params.clientId);
    const { title, name, phone, email, address, notes } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
    // Safety: ensure table exists (idempotent)
    try {
      sqlite.exec(`CREATE TABLE IF NOT EXISTS care_directory_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        name TEXT, phone TEXT, email TEXT, address TEXT, notes TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`);
    } catch {}
    const now = new Date().toISOString();
    try {
      const entry = db.insert(careDirectoryEntries).values({
        clientId, title: title.trim(),
        name: name?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
        createdAt: now, updatedAt: now,
      }).returning().get();
      res.json(entry);
    } catch (err: any) {
      console.error("[directory POST error]", err?.message);
      res.status(500).json({ message: "Server error: " + (err?.message || "unknown") });
    }
  });

  // PATCH update entry (MC only)
  app.patch("/api/clients/:clientId/directory/:entryId", requireAuth, (req: AuthRequest, res) => {
    if (req.authUserRole !== "primary_family") return res.status(403).json({ message: "MC only" });
    const entryId = Number(req.params.entryId);
    const { title, name, phone, email, address, notes } = req.body;
    const now = new Date().toISOString();
    const entry = db.update(careDirectoryEntries).set({
      ...(title !== undefined && { title: title.trim() }),
      ...(name !== undefined && { name: name?.trim() || null }),
      ...(phone !== undefined && { phone: phone?.trim() || null }),
      ...(email !== undefined && { email: email?.trim() || null }),
      ...(address !== undefined && { address: address?.trim() || null }),
      ...(notes !== undefined && { notes: notes?.trim() || null }),
      updatedAt: now,
    }).where(eq(careDirectoryEntries.id, entryId)).returning().get();
    res.json(entry);
  });

  // DELETE entry (MC only)
  app.delete("/api/clients/:clientId/directory/:entryId", requireAuth, (req: AuthRequest, res) => {
    if (req.authUserRole !== "primary_family") return res.status(403).json({ message: "MC only" });
    const entryId = Number(req.params.entryId);
    db.delete(careDirectoryEntries).where(eq(careDirectoryEntries.id, entryId)).run();
    res.json({ success: true });
  });

  // Care Flags
  app.get("/api/clients/:clientId/flags", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    res.json(storage.getCareFlagsByClient(Number(req.params.clientId)));
  });
  app.get("/api/clients/:clientId/caregivers/:caregiverId/flags", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    res.json(storage.getCareFlagsByCaregiver(Number(req.params.caregiverId), Number(req.params.clientId)));
  });
  app.post("/api/clients/:clientId/flags", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const flag = storage.createCareFlag({ ...req.body, clientId: Number(req.params.clientId) });
    // After creating a yellow flag, check if it triggers a red flag (3 unexcused yellows in same category in 30 days)
    if (flag.flagType === 'yellow') {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const count = storage.getUnexcusedFlagCount(flag.caregiverId, flag.clientId, flag.category, since);
      if (count >= 3) {
        storage.createCareFlag({
          clientId: flag.clientId,
          caregiverId: flag.caregiverId,
          flagType: 'red',
          category: flag.category,
          reason: `3 unexcused yellow flags in "${flag.category}" within 30 days — escalated to red flag`,
          referenceId: flag.id,
          referenceType: 'care_flag',
          triggeredAt: new Date().toISOString(),
        });
      }
    }
    res.status(201).json(flag);
  });
  app.post("/api/flags/:id/excuse", requireAuth, (req: AuthRequest, res) => {
    const { excuseNote, excusedByUserId } = req.body;
    if (!excuseNote || !excusedByUserId) return res.status(400).json({ message: "excuseNote and excusedByUserId required" });
    const flag = storage.excuseCareFlag(Number(req.params.id), excuseNote, Number(excusedByUserId));
    if (!flag) return res.status(404).json({ message: "Flag not found" });
    res.json(flag);
  });
  app.get("/api/clients/:clientId/caregivers/:caregiverId/rating", (req, res) => {
    const score = storage.getRatingScore(Number(req.params.caregiverId), Number(req.params.clientId));
    res.json({ score });
  });

  // Medications
  app.get("/api/clients/:clientId/medications", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const status = req.query.status as string | undefined;
    res.json(storage.getMedicationsByClient(Number(req.params.clientId), status));
  });
  app.get("/api/medications/:id", requireAuth, (req: AuthRequest, res) => {
    const m = storage.getMedicationById(Number(req.params.id));
    if (!m) return res.status(404).json({ error: "Not found" });
    res.json(m);
  });
  app.post("/api/clients/:clientId/medications", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const clientId = Number(req.params.clientId);
    const now = new Date().toISOString();
    const data = { ...req.body, clientId, createdAt: now, updatedAt: now };
    const med = storage.createMedication(data);

    // If added by MC (primary_family), notify all caregivers for this client
    if (req.body.addedByRole === "primary_family") {
      const caregivers = storage.getCaregiversByClientId(clientId);
      caregivers.forEach(cg => {
        storage.createNotification({
          userId: cg.id,
          clientId,
          title: "📊 Medication Regimen Updated by Family",
          body: `${med.name} ${med.dosage} has been added to the medication regimen by the Main Contact. Please review and confirm.`,
          type: "alert",
          priority: 'urgent',
          isRead: false,
          createdAt: now,
          linkTo: "/medications",
        });
      });
    }

    res.status(201).json(med);
  });
  app.patch("/api/medications/:id", requireAuth, (req: AuthRequest, res) => {
    const { changedByUserId, changeNote, ...data } = req.body;
    const medId = Number(req.params.id);
    const existing = storage.getMedicationById(medId);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!checkPortalAccess(req, existing.clientId)) return res.status(403).json({ message: "Access denied" });
    const result = storage.updateMedication(medId, data, changedByUserId, changeNote);
    if (!result) return res.status(404).json({ error: "Not found" });

    // Notify CGs of medication change (Urgent)
    if (existing?.clientId) {
      const now = new Date().toISOString();
      const updaterName = storage.getUserById(req.authUserId!)?.name ?? "Main Contact";
      const caregivers = storage.getCaregiversByClientId(existing.clientId);
      caregivers.forEach(cg => {
        if (cg.id === req.authUserId) return;
        storage.createNotification({
          userId: cg.id,
          clientId: existing.clientId,
          title: `📊 Medication updated: ${result.name}`,
          body: `${updaterName} updated ${result.name}${result.dosage ? ' (' + result.dosage + ')' : ''}. Please review the medication regimen.`,
          type: 'alert',
          priority: 'urgent',
          isRead: false,
          createdAt: now,
          linkTo: '/medications',
        });
      });
    }

    res.json(result);
  });
  app.post("/api/medications/:id/discontinue", requireAuth, (req: AuthRequest, res) => {
    const { reason, note, date, changedByUserId } = req.body;
    const result = storage.discontinueMedication(Number(req.params.id), reason, note, date, changedByUserId);
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  });
  app.get("/api/medications/:id/history", (req, res) => {
    res.json(storage.getMedicationHistory(Number(req.params.id)));
  });
  app.get("/api/clients/:clientId/medication-logs", (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    res.json(storage.getMedicationLogs(Number(req.params.clientId), limit));
  });
  app.get("/api/medications/:id/logs", (req, res) => {
    res.json(storage.getMedicationLogsByMed(Number(req.params.id)));
  });
  app.post("/api/clients/:clientId/medication-logs", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const data = { ...req.body, clientId: Number(req.params.clientId) };
    res.status(201).json(storage.createMedicationLog(data));
  });

  // Vitals & Bodily Functions
  app.get("/api/clients/:clientId/vitals", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    res.json(storage.getVitalsByClient(Number(req.params.clientId), limit));
  });
  app.get("/api/clients/:clientId/vitals/latest", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const v = storage.getLatestVitals(Number(req.params.clientId));
    res.json(v ?? null);
  });
  app.post("/api/clients/:clientId/vitals", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const clientId = Number(req.params.clientId);
    const data = { ...req.body, clientId };
    // Phase 2: self_care contributor — set pendingReview if minor client has approval on
    if (data.loggedByRole === "self_care") {
      const clientRecord = storage.getClientById(clientId);
      if (clientRecord?.requiresMinorApproval) {
        data.pendingReview = true;
      }
    }
    const record = storage.createVitals(data);
    res.status(201).json(record);
  });

  // ── Badge System ─────────────────────────────────────────────────────────

  // Get badge score for a caregiver (cached or compute fresh)
  app.get("/api/badge/:caregiverId/client/:clientId", async (req, res) => {
    try {
      const score = await getBadgeScore(Number(req.params.caregiverId), Number(req.params.clientId));
      res.json(score);
    } catch (e) {
      res.status(500).json({ message: "Failed to compute badge score" });
    }
  });

  // Force recompute
  app.post("/api/badge/:caregiverId/client/:clientId/compute", async (req, res) => {
    try {
      const score = await computeBadgeScore(Number(req.params.caregiverId), Number(req.params.clientId));
      res.json(score);
    } catch (e) {
      res.status(500).json({ message: "Failed to compute badge score" });
    }
  });

  // Submit monthly survey
  app.post("/api/badge/survey", (req, res) => {
    const { caregiverId, clientId, submittedByUserId, ...answers } = req.body;
    const month = new Date().toISOString().slice(0, 7); // "2026-04"

    // Upsert: one survey per caregiver per client per month
    const existing = db.select().from(badgeSurveys)
      .where(and(
        eq(badgeSurveys.caregiverId, caregiverId),
        eq(badgeSurveys.clientId, clientId),
        eq(badgeSurveys.periodMonth, month)
      )).get();

    if (existing) {
      // Update existing survey
      db.delete(badgeSurveys).where(eq(badgeSurveys.id, existing.id)).run();
    }

    const survey = db.insert(badgeSurveys).values({
      caregiverId,
      clientId,
      submittedByUserId,
      submittedAt: new Date().toISOString(),
      periodMonth: month,
      ...answers,
    }).returning().get();

    // Trigger immediate recompute after survey submission
    computeBadgeScore(caregiverId, clientId).catch(console.error);

    res.status(201).json(survey);
  });

  // ── A Collection of Thoughts ──────────────────────────────────────────────

  app.get("/api/clients/:clientId/thoughts", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    res.json(storage.getThoughtsByClient(Number(req.params.clientId)));
  });

  app.post("/api/clients/:clientId/thoughts", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const data = {
      ...req.body,
      clientId: Number(req.params.clientId),
      recordedAt: new Date().toISOString(),
    };
    res.status(201).json(storage.createThought(data));
  });

  app.patch("/api/thoughts/:id", requireAuth, (req: AuthRequest, res) => {
    const thought = storage.updateThought(Number(req.params.id), req.body);
    if (!thought) return res.status(404).json({ message: "Entry not found" });
    res.json(thought);
  });

  app.delete("/api/thoughts/:id", requireAuth, (req: AuthRequest, res) => {
    storage.deleteThought(Number(req.params.id));
    res.json({ success: true });
  });

  // Unlock entire collection (caregiver-initiated, end of care)
  app.post("/api/clients/:clientId/thoughts/unlock", requireAuth, (req: AuthRequest, res) => {
    const { unlockedByUserId, unlockNote } = req.body;
    storage.unlockAllThoughts(Number(req.params.clientId), unlockedByUserId, unlockNote);
    res.json({ success: true, unlockedAt: new Date().toISOString() });
  });

  app.get("/api/clients/:clientId/thoughts/unlock-status", (req, res) => {
    res.json({ isUnlocked: storage.isCollectionUnlocked(Number(req.params.clientId)) });
  });

  // Unlock status with metadata
  app.get("/api/clients/:clientId/thoughts/unlock-status-full", (req, res) => {
    const clientId = Number(req.params.clientId);
    const thoughts = storage.getThoughtsByClient(clientId);
    const unlocked = thoughts.find(t => t.isUnlocked);
    res.json({
      isUnlocked: !!unlocked,
      unlockedAt: unlocked?.unlockedAt ?? null,
      unlockNote: unlocked?.unlockNote ?? null,
    });
  });

  // ── Caregiver Profiles ─────────────────────────────────────────────────────
  app.get("/api/caregivers/:userId/profile", (req, res) => {
    const profile = storage.getCaregiverProfile(Number(req.params.userId));
    res.json(profile ?? null);
  });

  app.put("/api/caregivers/:userId/profile", requireAuth, (req: AuthRequest, res) => {
    const profile = storage.upsertCaregiverProfile(Number(req.params.userId), req.body);
    res.json(profile);
  });

  app.get("/api/directory/caregivers", (req, res) => {
    res.json(storage.getPublicCaregiverProfiles());
  });

  // ── Care Scope ────────────────────────────────────────────────────────────

  // GET current scope settings for a client/caregiver pair
  app.get("/api/scope/:clientId/:caregiverId", (req, res) => {
    const scope = storage.getCareScope(
      Number(req.params.clientId),
      Number(req.params.caregiverId)
    );
    // Return defaults if not configured yet
    res.json(scope ?? {
      clientId: Number(req.params.clientId),
      caregiverId: Number(req.params.caregiverId),
      medications: true,
      vitals: true,
      appointments: true,
      activityLog: true,
      messaging: true,
      medicationsNote: null,
      vitalsNote: null,
      appointmentsNote: null,
      pendingRequest: null,
    });
  });

  // PUT update scope (Primary FC only — enforcement is client-side for demo)
  app.put("/api/scope/:clientId/:caregiverId", requireAuth, (req: AuthRequest, res) => {
    const { updatedByUserId, ...data } = req.body;
    const scope = storage.upsertCareScope(
      Number(req.params.clientId),
      Number(req.params.caregiverId),
      data,
      updatedByUserId || 4 // default to primary FC for demo
    );
    res.json(scope);
  });

  // POST caregiver requests a scope change (awaits family approval)
  app.post("/api/scope/:clientId/:caregiverId/request", requireAuth, (req: AuthRequest, res) => {
    const { module, requestedState, reason, caregiverId } = req.body;
    const pendingRequest = JSON.stringify({ module, requestedState, reason, requestedAt: new Date().toISOString() });
    const scope = storage.upsertCareScope(
      Number(req.params.clientId),
      Number(req.params.caregiverId),
      { pendingRequest },
      Number(caregiverId)
    );
    res.json(scope);
  });

  // ── Flag Control routes ──────────────────────────────────────────────────

  // GET flag control settings
  app.get("/api/flag-control/:clientId/:caregiverId", (req, res) => {
    const fc = storage.getFlagControl(
      Number(req.params.clientId),
      Number(req.params.caregiverId)
    );
    res.json(fc ?? {
      clientId: Number(req.params.clientId),
      caregiverId: Number(req.params.caregiverId),
      medicationFlags: true,
      appointmentFlags: true,
      messageFlags: true,
      medicationFlagsNote: null,
      appointmentFlagsNote: null,
      messageFlagsNote: null,
    });
  });

  // PUT update flag control (Primary FC only — enforcement client-side for demo)
  app.put("/api/flag-control/:clientId/:caregiverId", requireAuth, (req: AuthRequest, res) => {
    const { updatedByUserId, ...data } = req.body;
    const fc = storage.upsertFlagControl(
      Number(req.params.clientId),
      Number(req.params.caregiverId),
      data,
      updatedByUserId || 4 // default to primary FC
    );
    res.json(fc);
  });

  // ── Wellbeing Routes ──────────────────────────────────────────────────────

  // POST — submit a check-in (creates DB record + returns AI response)
  app.post("/api/wellbeing/checkin", requireAuth, (req: AuthRequest, res) => {
    const { userId, clientId, caregiverMessage, moodRating, triggerType } = req.body;
    if (!userId || !caregiverMessage) return res.status(400).json({ error: "Missing required fields" });

    // Classify the message into theme/mood with a simple heuristic
    // (in production this would call an LLM — for demo we use keyword mapping)
    const msg = caregiverMessage.toLowerCase();
    let detectedTheme = "general";
    let detectedMood = "stressed";
    if (msg.includes("tired") || msg.includes("exhausted") || msg.includes("burnout") || msg.includes("worn")) {
      detectedMood = "exhausted"; detectedTheme = "burnout";
    } else if (msg.includes("family") && (msg.includes("home") || msg.includes("personal"))) {
      detectedMood = "overwhelmed"; detectedTheme = "family_stress";
    } else if (msg.includes("sibling") || msg.includes("back") || msg.includes("stress") || msg.includes("taking it out")) {
      detectedMood = "stressed"; detectedTheme = "difficult_family";
    } else if (msg.includes("cry") || msg.includes("bad news") || msg.includes("hopeless") || msg.includes("hospital") || msg.includes("hospital")) {
      detectedMood = "grieving"; detectedTheme = "client_decline";
    } else if (msg.includes("mom") || msg.includes("mother") || msg.includes("dad") || msg.includes("parent") || msg.includes("my own")) {
      detectedMood = "overwhelmed"; detectedTheme = "personal_crisis";
    } else if (msg.includes("alone") || msg.includes("lonely") || msg.includes("nobody") || msg.includes("no one")) {
      detectedMood = "lonely"; detectedTheme = "lonely";
    } else if (msg.includes("appreciate") || msg.includes("thank") || msg.includes("notice") || msg.includes("invisible") || msg.includes("taken for granted") || msg.includes("nobody cares")) {
      detectedMood = "stressed"; detectedTheme = "unappreciated";
    }

    // Pull Becky's response library from DB — prefer library entries, fall back to hardcoded
    const libraryForTheme = storage.getResponsesForTheme(detectedTheme);
    const libraryGeneral = storage.getResponsesForTheme("general");
    const libraryPool = libraryForTheme.length > 0 ? libraryForTheme : libraryGeneral;
    if (libraryPool.length > 0) {
      const picked = libraryPool[Math.floor(Math.random() * libraryPool.length)];
      const checkIn = storage.createWellbeingCheckIn({
        userId: Number(userId),
        clientId: clientId ? Number(clientId) : null,
        caregiverMessage: caregiverMessage,
        aiResponse: picked.response,
        detectedMood: detectedMood,
        detectedTheme: detectedTheme,
        triggerType: triggerType || "manual",
        moodRating: moodRating || null,
        audioPlayed: 0,
        createdAt: new Date().toISOString(),
      });
      const streak = storage.upsertWellbeingStreak(Number(userId));
      return res.json({ checkIn, streak });
    }

    // Hardcoded fallback (used only if library is completely empty)
    const responses: Record<string, string[]> = {
      burnout: [
        // [BECKY EDIT] Theme: Exhaustion / Burnout — Response 1
        "I hear you. And I want you to know — that tired feeling you\'re carrying is real. It is not weakness. It is the evidence of how much you have poured into someone else\'s life. I\'ve been in that same place where I didn\'t even know what I needed, I just knew I was done. You don\'t have to fix that tonight. But I do want you to let yourself rest without guilt. What you feel right now makes complete sense.",
        // [BECKY EDIT] Theme: Exhaustion / Burnout — Response 2
        "That kind of tired goes so much deeper than sleep, doesn\'t it? I remember days where I drove home in silence because I had nothing left — not even music. And I still had to walk into my own house and be a person. That is a specific kind of hard that most people never understand. But I do. And I\'m proud of you for still showing up. Take whatever rest you can get tonight. You\'ve earned it.",
        // [BECKY EDIT] Theme: Exhaustion / Burnout — Response 3
        "Can I just say something? The fact that you\'re checking in right now, when you\'re this worn down, says everything about who you are. You could have just gone home and crashed. But you took a second to acknowledge yourself. That matters. You matter. I\'m not going to tell you to take a bubble bath. I\'m going to tell you that what you do is hard, it is real, and you are not invisible to me.",
      ],
      family_stress: [
        // [BECKY EDIT] Theme: Personal Life Bleeding In — Response 1
        "I know what it\'s like to walk through that door carrying something from home that you never asked to bring to work. You set it down at the door. You give your whole self to someone else\'s loved one. And then you pick that weight back up on the way out. That is one of the most invisible sacrifices a caregiver makes — and nobody talks about it. I see you. Both of your worlds are real, and both of them deserve to be acknowledged.",
        // [BECKY EDIT] Theme: Personal Life Bleeding In — Response 2
        "You are holding so much right now. And the fact that you showed up anyway — that\'s not small. That is the kind of commitment that doesn\'t come with a title or a raise. It comes from character. But I also want you to know: you are allowed to not be okay. You don\'t have to perform strength right now. Not here. Not with me. What\'s really going on at home?",
      ],
      difficult_family: [
        // [BECKY EDIT] Theme: Difficult Family Dynamics — Response 1
        "Here is something I had to learn the hard way: when a family member comes at you sideways, it is almost never actually about you. It is fear. It is grief. It is the helplessness of watching someone they love decline, and you are the closest person to aim that at. That doesn\'t make it okay. But it might help it hurt a little less. You are not doing anything wrong. You are just the safe person in an unsafe situation.",
        // [BECKY EDIT] Theme: Difficult Family Dynamics — Response 2
        "That is such a hard spot to be in — where you\'re trying to do your best and someone is making you feel like your best isn\'t enough. I\'ve been there. And I had to remind myself that I was hired because I\'m qualified, I show up, and I genuinely care. Nobody gets to take that from me. Nobody gets to take it from you either. You\'re handling this with more grace than most people ever could.",
        // [BECKY EDIT] Theme: Difficult Family Dynamics — Response 3
        "Sometimes the most professional thing you can do is feel hurt in private and then keep going. That\'s not suppression — that\'s strength. But please don\'t stay in the private part alone. Bring it here. Bring it to someone who gets it. The burden of being the calm one in a room full of scared people is real, and you deserve a place to put it down.",
      ],
      client_decline: [
        // [BECKY EDIT] Theme: Hard Client Moments / Grief — Response 1
        "You were in that room. You saw those faces. And you kept yourself steady even while you were quietly breaking inside. That is one of the most profound things a caregiver does — holding space for someone else\'s pain while carrying your own. That does not go unnoticed. Not by me. I\'ve been in that kitchen making coffee, handing out tissues, and trying not to let them see my eyes. I know exactly what you\'re carrying right now.",
        // [BECKY EDIT] Theme: Hard Client Moments / Grief — Response 2
        "The hard truth about this work is that you are going to love people you are going to lose. And that love is not unprofessional. It is what makes you good at what you do. What you felt today — that hurt — it means you did it right. You were present. You were real. And that family will never forget it, even if they don\'t have words for it yet. Give yourself permission to grieve too.",
      ],
      personal_crisis: [
        // [BECKY EDIT] Theme: Caregiver Also Has a Loved One in Crisis — Response 1
        "I cannot imagine how that feels — being so focused on caring for someone else\'s family while your own is going through something that needs you too. That is one of the deepest tests a caregiver faces. And there is no clean answer for it. I just want you to know: you are allowed to feel the weight of that. You are not less of a professional for also being a human being with people you love.",
        // [BECKY EDIT] Theme: Caregiver Also Has a Loved One in Crisis — Response 2
        "I have had moments where I was sitting with a client and my mind was somewhere else completely — with my own family, my own fear. And I felt guilty for every second of it. But I kept showing up. Just like you are. I want you to give yourself the same compassion you give everyone else. You deserve care too. What can you do for yourself today, even something small?",
      ],
      lonely: [
        // [BECKY EDIT] Theme: Loneliness / Feeling Unseen — Response 1
        "You know what I think sometimes? That the loneliest people in a caregiving situation are often the caregivers. You are surrounded by people, and yet you are quietly invisible. The family sees the tasks. The client needs the care. And you just keep going. I want you to know that I see the whole of what you do — not just the tasks, but the emotional labor. The heart behind it. That matters, and you matter.",
        // [BECKY EDIT] Theme: Loneliness / Feeling Unseen — Response 2
        "Reaching out when you feel alone takes courage. I\'m really glad you did. Sometimes all we need is for someone to say — I hear you, I\'m here, and you are not as alone as it feels right now. So here I am saying it: I\'m here. And I mean it. What would make today even a little better for you?",
      ],
      unappreciated: [
        // [BECKY EDIT] Theme: Feeling Unappreciated or Taken for Granted — Response 1
        "This one stings in a specific way, doesn\'t it? Because you pour yourself into this work, and sometimes the response is silence. Or worse, criticism. I want you to hear me: your value is not determined by whether someone said thank you today. The care you gave was real. The difference you made was real. Some days the best we get is knowing in our own heart that we showed up fully. And you did.",
        // [BECKY EDIT] Theme: Feeling Unappreciated or Taken for Granted — Response 2
        "Gratitude in this field is inconsistent. I learned that. But I also learned that my reasons for doing this work had to come from inside me, not from waiting for someone to notice. That doesn\'t mean it doesn\'t hurt when they don\'t. It does. Feel that. And then remember why you started. What made you choose this work in the first place?",
      ],
      general: [
        // [BECKY EDIT] Theme: General / Unspecified — Response 1
        "Thank you for trusting me enough to reach out. Really. I know it can feel strange — typing your heart out into a screen. But I want you to know that whoever you are and whatever you\'re carrying today, you are not doing this alone. You are part of a community of people who chose one of the hardest callings there is. And that matters. You matter. I\'m here.",
        // [BECKY EDIT] Theme: General / Unspecified — Response 2
        "I\'m glad you checked in. Not every hard moment needs a fix — sometimes you just need someone to say: I hear you, I see you, and what you do has meaning. All three of those things are true right now. You are seen. And I\'m proud of you for pausing long enough to take care of yourself for once.",
        // [BECKY EDIT] Theme: General / Unspecified — Response 3
        "Some days this work is genuinely beautiful. And some days it is genuinely heavy. Today sounds like a heavy one. I just want to sit with you in that for a second before anything else. You don\'t have to fix it right now. You don\'t have to explain it. You just needed a place to put it. This is that place. And I\'m not going anywhere.",
      ],
    };

    const pool = responses[detectedTheme] || responses.general;
    const aiResponse = pool[Math.floor(Math.random() * pool.length)];

    const checkIn = storage.createWellbeingCheckIn({
      userId: Number(userId),
      clientId: clientId ? Number(clientId) : null,
      caregiverMessage,
      aiResponse,
      detectedMood,
      detectedTheme,
      triggerType: triggerType || "manual",
      moodRating: moodRating ? Number(moodRating) : null,
      audioPlayed: false,
      createdAt: new Date().toISOString(),
    });

    const streak = storage.upsertWellbeingStreak(Number(userId));
    res.json({ checkIn, streak });
  });

  // GET — history of check-ins for a user
  app.get("/api/wellbeing/history/:userId", requireAuth, (req: AuthRequest, res) => {
    const history = storage.getWellbeingCheckIns(Number(req.params.userId), 50);
    res.json(history);
  });

  // GET — streak info for a user
  app.get("/api/wellbeing/streak/:userId", requireAuth, (req: AuthRequest, res) => {
    const streak = storage.getWellbeingStreak(Number(req.params.userId));
    res.json(streak || { currentStreak: 0, longestStreak: 0, totalCheckIns: 0, earnedBadges: "[]" });
  });

  // GET — check if proactive nudge should fire (high urgency in last 72h)
  app.get("/api/wellbeing/nudge/:userId/client/:clientId", requireAuth, (req: AuthRequest, res) => {
    const count = storage.getRecentUrgentFlagCount(Number(req.params.userId), Number(req.params.clientId), 72);
    res.json({ shouldNudge: count >= 3, urgentCount: count });
  });

  // ── Becky Response Library (Admin) ──────────────────────────────────────

  app.get("/api/becky-library", (req, res) => {
    const { theme } = req.query;
    const items = storage.getBeckyResponses(theme as string | undefined);
    // Also return all distinct themes
    const all = storage.getBeckyResponses();
    const themes = [...new Set(all.map(r => r.theme))].sort();
    res.json({ items, themes });
  });

  app.post("/api/becky-library", (req, res) => {
    const { theme, examplePrompt, response } = req.body;
    if (!theme || !examplePrompt || !response) {
      return res.status(400).json({ message: "theme, examplePrompt, and response are required" });
    }
    const now = new Date().toISOString();
    const item = storage.createBeckyResponse({
      theme: theme.trim().toLowerCase().replace(/\s+/g, "_"),
      examplePrompt: examplePrompt.trim(),
      response: response.trim(),
      isPlaceholder: 0,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });
    res.json(item);
  });

  app.patch("/api/becky-library/:id", (req, res) => {
    const id = Number(req.params.id);
    const updated = storage.updateBeckyResponse(id, req.body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.delete("/api/becky-library/:id", (req, res) => {
    storage.deleteBeckyResponse(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── ElevenLabs TTS — Becky's voice ────────────────────────────────────────
  // Proxies TTS requests server-side so the API key is never exposed to the browser
  app.post("/api/tts/becky", async (req, res) => {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ message: "text is required" });
    }
    const VOICE_ID = "XDqLnI3WPivoF2kaTztW";
    const API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!API_KEY) {
      return res.status(503).json({ message: "TTS not configured" });
    }
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
        {
          method: "POST",
          headers: {
            "xi-api-key": API_KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
          },
          body: JSON.stringify({
            text: text.slice(0, 2500), // safety cap
            model_id: "eleven_turbo_v2_5",
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
          }),
        }
      );
      if (!response.ok) {
        const err = await response.text();
        return res.status(502).json({ message: "ElevenLabs error", detail: err });
      }
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      // Stream the audio directly to the client
      const reader = response.body!.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        res.write(Buffer.from(value));
        return pump();
      };
      await pump();
    } catch (err: any) {
      res.status(500).json({ message: "TTS failed", detail: err?.message });
    }
  });

  // ── Care Net University ──────────────────────────────────────────────────

  // POST — mark a lesson complete, award Knowledge points
  app.post("/api/university/complete", (req, res) => {
    const { userId, lessonId, trackId, knowledgePoints } = req.body;
    if (!userId || !lessonId || !trackId) {
      return res.status(400).json({ message: "userId, lessonId, and trackId are required" });
    }
    const record = storage.completeLesson(
      Number(userId), String(lessonId), String(trackId), Number(knowledgePoints) || 0
    );
    const totalPoints = storage.getTotalKnowledgePoints(Number(userId));
    res.json({ record, totalPoints });
  });

  // GET — completed lessons for a user
  app.get("/api/university/progress/:userId", (req, res) => {
    const completed = storage.getCompletedLessons(Number(req.params.userId));
    const totalPoints = storage.getTotalKnowledgePoints(Number(req.params.userId));
    res.json({ completed, totalPoints });
  });

  // Check if survey already submitted this month
  app.get("/api/badge/survey/status/:caregiverId/client/:clientId", (req, res) => {
    const month = new Date().toISOString().slice(0, 7);
    const existing = db.select().from(badgeSurveys)
      .where(and(
        eq(badgeSurveys.caregiverId, Number(req.params.caregiverId)),
        eq(badgeSurveys.clientId, Number(req.params.clientId)),
        eq(badgeSurveys.periodMonth, month)
      )).get();
    res.json({ submitted: !!existing, survey: existing || null });
  });

  // ── Pattern Recognition Engine ─────────────────────────────────────────────

  // GET all active patterns for a client
  app.get("/api/clients/:clientId/patterns", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), (req: AuthRequest, res) => {
    const clientId = Number(req.params.clientId);
    const Database = require("better-sqlite3");
    const path = require("path");
    const dbPath = path.resolve(process.cwd(), "data.db");
    const rawDb = new Database(dbPath);
    const patterns = rawDb.prepare(
      `SELECT * FROM health_patterns WHERE client_id=? ORDER BY
       CASE severity WHEN 'severe' THEN 0 WHEN 'moderate' THEN 1 ELSE 2 END,
       last_seen_at DESC`
    ).all(clientId);
    rawDb.close();
    res.json(patterns);
  });

  // GET observation tags for a client (last 30 days)
  app.get("/api/clients/:clientId/observation-tags", (req, res) => {
    const clientId = Number(req.params.clientId);
    const Database = require("better-sqlite3");
    const path = require("path");
    const dbPath = path.resolve(process.cwd(), "data.db");
    const rawDb = new Database(dbPath);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const tags = rawDb.prepare(
      `SELECT * FROM observation_tags WHERE client_id=? AND observed_at >= ? ORDER BY observed_at DESC`
    ).all(clientId, since);
    rawDb.close();
    res.json(tags);
  });

  // POST run pattern engine on demand
  app.post("/api/clients/:clientId/patterns/run", requireAuth, requirePortalAccess(r => Number(r.params.clientId)), async (req: AuthRequest, res) => {
    const clientId = Number(req.params.clientId);
    try {
      resurfaceDismissedPatterns(clientId);
      checkResolvedPatterns(clientId);
      await runPatternEngine(clientId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH dismiss a pattern (snooze for 7 days)
  app.patch("/api/patterns/:id/dismiss", (req, res) => {
    const { userId } = req.body;
    const Database = require("better-sqlite3");
    const path = require("path");
    const dbPath = path.resolve(process.cwd(), "data.db");
    const rawDb = new Database(dbPath);
    const now = new Date();
    const dismissedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    rawDb.prepare(
      `UPDATE health_patterns SET status='dismissed', dismissed_at=?, dismissed_by_user_id=?, dismissed_until=?, updated_at=? WHERE id=?`
    ).run(now.toISOString(), userId, dismissedUntil, now.toISOString(), req.params.id);
    rawDb.close();
    res.json({ success: true, dismissedUntil });
  });

  // PATCH escalate a pattern (MC override — opens doctor note)
  app.patch("/api/patterns/:id/escalate", (req, res) => {
    const { userId } = req.body;
    const Database = require("better-sqlite3");
    const path = require("path");
    const dbPath = path.resolve(process.cwd(), "data.db");
    const rawDb = new Database(dbPath);
    const now = new Date().toISOString();
    rawDb.prepare(
      `UPDATE health_patterns SET status='escalated', escalated_at=?, escalated_by_user_id=?, updated_at=? WHERE id=?`
    ).run(now, userId, now, req.params.id);
    rawDb.close();
    res.json({ success: true });
  });

  // PATCH acknowledge a pattern alert (mark as read by this user)
  app.patch("/api/patterns/:id/acknowledge", (req, res) => {
    const { userId, alertLevel } = req.body;
    const Database = require("better-sqlite3");
    const path = require("path");
    const dbPath = path.resolve(process.cwd(), "data.db");
    const rawDb = new Database(dbPath);
    const now = new Date().toISOString();
    // Check if already acknowledged
    const exists = rawDb.prepare(
      `SELECT id FROM pattern_acknowledgements WHERE pattern_id=? AND user_id=? AND alert_level=?`
    ).get(req.params.id, userId, alertLevel);
    if (!exists) {
      rawDb.prepare(
        `INSERT INTO pattern_acknowledgements (pattern_id, user_id, alert_level, acknowledged_at) VALUES (?,?,?,?)`
      ).run(req.params.id, userId, alertLevel, now);
    }
    rawDb.close();
    res.json({ success: true });
  });

  // PATCH update doctor note text
  app.patch("/api/patterns/:id/doctor-note", (req, res) => {
    const { doctorNoteText, sentByUserId } = req.body;
    const Database = require("better-sqlite3");
    const path = require("path");
    const dbPath = path.resolve(process.cwd(), "data.db");
    const rawDb = new Database(dbPath);
    const now = new Date().toISOString();
    if (sentByUserId) {
      // Mark as sent
      rawDb.prepare(
        `UPDATE health_patterns SET doctor_note_text=?, doctor_note_sent_at=?, doctor_note_sent_by_user_id=?, status='escalated', escalated_at=?, updated_at=? WHERE id=?`
      ).run(doctorNoteText, now, sentByUserId, now, now, req.params.id);
    } else {
      // Just update the draft
      rawDb.prepare(`UPDATE health_patterns SET doctor_note_text=?, updated_at=? WHERE id=?`)
        .run(doctorNoteText, now, req.params.id);
    }
    rawDb.close();
    res.json({ success: true });
  });

  // GET pattern preferences for a user
  app.get("/api/users/:userId/pattern-preferences", (req, res) => {
    const Database = require("better-sqlite3");
    const path = require("path");
    const dbPath = path.resolve(process.cwd(), "data.db");
    const rawDb = new Database(dbPath);
    const prefs = rawDb.prepare(`SELECT * FROM pattern_preferences WHERE user_id=?`).get(req.params.userId);
    rawDb.close();
    res.json(prefs || null);
  });

  // PUT update pattern preferences
  app.put("/api/users/:userId/pattern-preferences", (req, res) => {
    const userId = Number(req.params.userId);
    const { clientId, watchSymptoms, watchActivity, watchFood, watchSleep, watchVitals, notifyThreshold } = req.body;
    const Database = require("better-sqlite3");
    const path = require("path");
    const dbPath = path.resolve(process.cwd(), "data.db");
    const rawDb = new Database(dbPath);
    const now = new Date().toISOString();
    const existing = rawDb.prepare(`SELECT id FROM pattern_preferences WHERE user_id=?`).get(userId);
    if (existing) {
      rawDb.prepare(
        `UPDATE pattern_preferences SET watch_symptoms=?, watch_activity=?, watch_food=?, watch_sleep=?, watch_vitals=?, notify_threshold=?, updated_at=? WHERE user_id=?`
      ).run(watchSymptoms?1:0, watchActivity?1:0, watchFood?1:0, watchSleep?1:0, watchVitals?1:0, notifyThreshold, now, userId);
    } else {
      rawDb.prepare(
        `INSERT INTO pattern_preferences (user_id, client_id, watch_symptoms, watch_activity, watch_food, watch_sleep, watch_vitals, notify_threshold, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`
      ).run(userId, clientId, watchSymptoms?1:0, watchActivity?1:0, watchFood?1:0, watchSleep?1:0, watchVitals?1:0, notifyThreshold, now);
    }
    rawDb.close();
    res.json({ success: true });
  });

  // ── DEMO ACCOUNT ──────────────────────────────────────────────────────────
  // POST /api/admin/demo/seed — creates or resets the demo account
  // Admin-only: gated by adminKey header
  // Demo credentials: cnpdemo@carenetportal.com / DemoPassword2026
  // No special characters — prevents Android autofill from dropping the last character.

  const DEMO_EMAIL = "cnpdemo@carenetportal.com";
  const DEMO_PASSWORD = "DemoPassword2026";
  const DEMO_ADMIN_KEY = "cnp-demo-reset-2026";

  app.post("/api/admin/demo/seed", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const key = req.headers["x-demo-key"];
    if (key !== DEMO_ADMIN_KEY) return res.status(403).json({ message: "Unauthorized" });

    try {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const fmt = (offsetDays: number, hour = 9, min = 0) => {
        const d = new Date(now);
        d.setDate(d.getDate() + offsetDays);
        d.setHours(hour, min, 0, 0);
        return d.toISOString();
      };

      // ── Wipe existing demo data ──────────────────────────────────────────
      // Wipe demo CG account first (prevents UNIQUE constraint on re-seed)
      const existingCGAcct = db.select().from(authAccounts).where(eq(authAccounts.email, "democg@carenetportal.com")).get();
      if (existingCGAcct) {
        db.delete(authSessions).where(eq(authSessions.authAccountId, existingCGAcct.id)).run();
        if (existingCGAcct.userId) db.delete(users).where(eq(users.id, existingCGAcct.userId)).run();
        db.delete(authAccounts).where(eq(authAccounts.id, existingCGAcct.id)).run();
      }

      const existingAccount = db.select().from(authAccounts).where(eq(authAccounts.email, DEMO_EMAIL)).get();
      if (existingAccount?.userId) {
        const demoUser = db.select().from(users).where(eq(users.id, existingAccount.userId)).get();
        if (demoUser?.clientId) {
          const cid = demoUser.clientId;
          // Delete in dependency order
          const threads = db.select().from(chatThreads).where(eq(chatThreads.clientId, cid)).all();
          for (const t of threads) {
            db.delete(messages).where(eq(messages.threadId, t.id)).run();
          }
          db.delete(chatThreads).where(eq(chatThreads.clientId, cid)).run();
          db.delete(activityLogs).where(eq(activityLogs.clientId, cid)).run();
          db.delete(scheduleEvents).where(eq(scheduleEvents.clientId, cid)).run();
          db.delete(vitals).where(eq(vitals.clientId, cid)).run();
          db.delete(medications).where(eq(medications.clientId, cid)).run();
          db.delete(clients).where(eq(clients.id, cid)).run();
        }
        db.delete(users).where(eq(users.id, existingAccount.userId)).run();
      }
      if (existingAccount) {
        db.delete(authSessions).where(eq(authSessions.authAccountId, existingAccount.id)).run();
        db.delete(authAccounts).where(eq(authAccounts.id, existingAccount.id)).run();
      }

      // ── Create demo MC user ──────────────────────────────────────────────
      const demoUser = db.insert(users).values({
        name: "Demo User",
        role: "primary_family",
        email: DEMO_EMAIL,
        onboardingCompletedAt: now.toISOString(),
        mcSetupCompletedAt: now.toISOString(),
        avatarInitials: "DU",
      }).returning().get();

      // ── Create demo client ───────────────────────────────────────────────
      const demoClient = db.insert(clients).values({
        name: "Donnie Demo",
        dateOfBirth: "1942-03-15",
        primaryCondition: "Early-stage Alzheimer's disease",
        caregiverId: demoUser.id,
        primaryContactId: demoUser.id,
        diagnoses: JSON.stringify([
          { name: "Alzheimer's disease", severity: "serious", dateNoted: "2024-01-10" },
          { name: "Type 2 Diabetes", severity: "managed", dateNoted: "2019-06-22" },
          { name: "Hypertension", severity: "managed", dateNoted: "2018-03-05" },
        ]),
        allergies: JSON.stringify([
          { name: "Penicillin", severity: "serious" },
          { name: "Sulfa drugs", severity: "mild" },
        ]),
        assistiveDevices: JSON.stringify([
          { device: "Walker", notes: "Standard 4-wheel walker, used for all ambulation" },
          { device: "Hearing aid", notes: "Right ear only" },
        ]),
        notes: "Donnie does best with consistent routines. Morning is his best time — schedule important conversations before noon. He enjoys classic country music and old westerns.",
        isActive: true,
        appMode: "caregiver",
      }).returning().get();

      // Link user to client
      db.update(users).set({ clientId: demoClient.id }).where(eq(users.id, demoUser.id)).run();

      // ── Create demo caregiver user (for realistic messages) ──────────────
      const demoCG = db.insert(users).values({
        name: "Sarah (Demo CG)",
        role: "caregiver",
        email: "democg@carenetportal.com",
        clientId: demoClient.id,
        onboardingCompletedAt: now.toISOString(),
        avatarInitials: "SC",
      }).returning().get();

      // ── Auth account ─────────────────────────────────────────────────────
      const passwordHash = await hashPassword(DEMO_PASSWORD);
      db.insert(authAccounts).values({
        email: DEMO_EMAIL,
        passwordHash,
        userId: demoUser.id,
        emailVerified: true,
        createdAt: now.toISOString(),
        lastLoginAt: now.toISOString(),
      }).run();

      // ── Auth account for demo CG (so CG portal can be accessed for screenshots/testing) ──
      const cgPasswordHash = await hashPassword(DEMO_PASSWORD);
      const DEMO_CG_EMAIL = "democg@carenetportal.com"; // lowercase — login endpoint lowercases input
      db.insert(authAccounts).values({
        email: DEMO_CG_EMAIL,
        passwordHash: cgPasswordHash,
        userId: demoCG.id,
        emailVerified: true,
        createdAt: now.toISOString(),
        lastLoginAt: now.toISOString(),
      }).run();

      const cid = demoClient.id;

      // ── Care Log entries ─────────────────────────────────────────────────
      const careLogEntries = [
        { title: "Morning medications administered", description: "Donnie took all morning medications without resistance. Good mood, ate a full breakfast beforehand.", category: "medication", priority: 'normal', loggedAt: fmt(-1, 8, 15), isChecked: true, loggedByRole: "caregiver" },
        { title: "Assisted with morning hygiene", description: "Showered, shaved, and dressed independently with minimal prompting. Chose his own clothes — a good sign.", category: "hygiene", priority: 'normal', loggedAt: fmt(-1, 9, 0), isChecked: true, loggedByRole: "caregiver" },
        { title: "Breakfast — good appetite", description: "Scrambled eggs, toast, and orange juice. Ate everything. Asked for seconds on the eggs.", category: "meal", priority: 'normal', loggedAt: fmt(-1, 9, 30), isChecked: true, loggedByRole: "caregiver" },
        { title: "Confusion episode — mid-morning", description: "Around 10:30am Donnie became briefly confused about the day and asked about going to work. Redirected with photos and calm conversation. Resolved in about 10 minutes. No distress.", category: "mood", priority: 'important', loggedAt: fmt(-1, 10, 45), isChecked: false, loggedByRole: "caregiver" },
        { title: "Lunch administered and tolerated well", description: "Chicken soup and crackers. Good fluid intake today — approximately 32 oz.", category: "meal", priority: 'normal', loggedAt: fmt(-1, 12, 15), isChecked: true, loggedByRole: "caregiver" },
        { title: "Afternoon walk — 20 minutes", description: "Walked the block twice with the walker. Slow but steady. Good weather helped his mood.", category: "general", priority: 'normal', loggedAt: fmt(-1, 14, 30), isChecked: true, loggedByRole: "caregiver" },
        { title: "Evening medications administered", description: "All evening medications taken. Donnie was tired and ready for bed by 8pm.", category: "medication", priority: 'normal', loggedAt: fmt(-1, 20, 0), isChecked: true, loggedByRole: "caregiver" },
        { title: "Morning medications", description: "Donnie took all medications with breakfast. Cheerful this morning — recognized a song on the radio.", category: "medication", priority: 'normal', loggedAt: fmt(0, 8, 10), isChecked: true, loggedByRole: "caregiver" },
        { title: "Refused shower", description: "Donnie was resistant to showering this morning. Did not push it — will try again this afternoon. Washed hands and face instead.", category: "hygiene", priority: 'important', loggedAt: fmt(0, 9, 20), isChecked: false, loggedByRole: "caregiver" },
      ];
      for (const e of careLogEntries) {
        db.insert(activityLogs).values({ clientId: cid, loggedByUserId: demoCG.id, ...e, isEmergency: false, isLateEntry: false, isOffShiftEntry: false, isExcused: false }).run();
      }

      // ── Schedule events ──────────────────────────────────────────────────
      const scheduleItems = [
        { title: "Morning medications", type: "medication", scheduledAt: fmt(1, 8, 0), recurrence: "daily", priority: 'normal', caregiverResponsible: true, notes: "Metformin, Lisinopril, Donepezil" },
        { title: "Dr. Martinez — Neurology follow-up", type: "appointment", scheduledAt: fmt(3, 10, 30), recurrence: "none", priority: 'normal', location: "Vanderbilt Neurology Clinic", caregiverResponsible: false, notes: "Family will transport. Bring medication list and the last 30 days of care logs.", responsibilityNote: "Family handling transport and appointment" },
        { title: "Evening medications", type: "medication", scheduledAt: fmt(1, 20, 0), recurrence: "daily", priority: 'normal', caregiverResponsible: true, notes: "Aspirin, Atorvastatin" },
        { title: "Physical therapy — in-home", type: "therapy", scheduledAt: fmt(2, 11, 0), recurrence: "weekly", priority: 'normal', caregiverResponsible: true, notes: "PT focuses on balance and fall prevention. Donnie responds well to encouragement." },
        { title: "Blood sugar check", type: "task", scheduledAt: fmt(1, 7, 30), recurrence: "daily", priority: 'normal', caregiverResponsible: true, notes: "Log result in vitals. Target range 80–130 fasting." },
        { title: "Weekly family check-in call", type: "other", scheduledAt: fmt(5, 18, 0), recurrence: "weekly", priority: 'normal', caregiverResponsible: false, notes: "Video call with the family. Donnie usually enjoys these.", responsibilityNote: "Family will initiate the call" },
      ];
      for (const s of scheduleItems) {
        db.insert(scheduleEvents).values({ clientId: cid, isCompleted: false, alarmEnabled: false, reminderMinutes: 30, ...s } as any).run();
      }

      // ── Medications ──────────────────────────────────────────────────────
      const meds = [
        { name: "Donepezil", genericName: "Donepezil HCl", form: "tablet", dosageAmount: 10, dosageUnit: "mg", scheduleType: "scheduled", frequency: "once_daily", scheduledTimes: JSON.stringify(["08:00"]), purpose: "Alzheimer's disease — cognitive symptom management", prescribingPhysician: "Dr. Elena Martinez, Neurology", instructions: "Take in the morning with food", status: "active", startDate: "2024-01-15" },
        { name: "Metformin", genericName: "Metformin HCl", form: "tablet", dosageAmount: 500, dosageUnit: "mg", scheduleType: "scheduled", frequency: "twice_daily", scheduledTimes: JSON.stringify(["08:00", "18:00"]), purpose: "Type 2 Diabetes — blood sugar control", prescribingPhysician: "Dr. James Patel, Primary Care", instructions: "Take with meals", status: "active", startDate: "2019-06-22" },
        { name: "Lisinopril", genericName: "Lisinopril", form: "tablet", dosageAmount: 10, dosageUnit: "mg", scheduleType: "scheduled", frequency: "once_daily", scheduledTimes: JSON.stringify(["08:00"]), purpose: "Hypertension — blood pressure management", prescribingPhysician: "Dr. James Patel, Primary Care", instructions: "Take in the morning. Monitor for dizziness.", status: "active", startDate: "2018-03-05" },
        { name: "Aspirin", genericName: "Aspirin", form: "tablet", dosageAmount: 81, dosageUnit: "mg", scheduleType: "scheduled", frequency: "once_daily", scheduledTimes: JSON.stringify(["20:00"]), purpose: "Cardiovascular — daily low-dose aspirin therapy", prescribingPhysician: "Dr. James Patel, Primary Care", instructions: "Take in the evening with water", status: "active", startDate: "2020-01-01" },
        { name: "Atorvastatin", genericName: "Atorvastatin Calcium", form: "tablet", dosageAmount: 20, dosageUnit: "mg", scheduleType: "scheduled", frequency: "once_daily", scheduledTimes: JSON.stringify(["20:00"]), purpose: "Cholesterol management", prescribingPhysician: "Dr. James Patel, Primary Care", instructions: "Take in the evening", status: "active", startDate: "2021-04-10" },
      ];
      for (const m of meds) {
        db.insert(medications).values({ clientId: cid, createdAt: now.toISOString(), updatedAt: now.toISOString(), ...m } as any).run();
      }

      // ── Vitals ───────────────────────────────────────────────────────────
      const vitalsData = [
        { recordedAt: fmt(-3, 8, 30), bloodPressureSystolic: 138, bloodPressureDiastolic: 86, heartRate: 74, temperature: 98.4, oxygenSaturation: 97, weight: 168, bloodGlucose: 112, painLevel: 1, mood: "calm", cognitionLevel: "oriented", fluidIntake: 40, bowelMovement: true, bowelNotes: "normal", urination: true, urinationNotes: "normal" },
        { recordedAt: fmt(-2, 8, 15), bloodPressureSystolic: 142, bloodPressureDiastolic: 88, heartRate: 78, temperature: 98.6, oxygenSaturation: 96, weight: 168, bloodGlucose: 124, painLevel: 2, mood: "anxious", cognitionLevel: "mild_confusion", fluidIntake: 32, bowelMovement: false, urination: true, urinationNotes: "normal", notes: "Seemed anxious at check. BP slightly elevated — likely situational." },
        { recordedAt: fmt(-1, 8, 20), bloodPressureSystolic: 136, bloodPressureDiastolic: 84, heartRate: 72, temperature: 98.2, oxygenSaturation: 98, weight: 167, bloodGlucose: 108, painLevel: 0, mood: "happy", cognitionLevel: "oriented", fluidIntake: 48, bowelMovement: true, bowelNotes: "normal", urination: true, urinationNotes: "normal", notes: "Great morning. Most lucid he's been all week." },
      ];
      for (const v of vitalsData) {
        db.insert(vitals).values({ clientId: cid, caregiverId: demoCG.id, ...v } as any).run();
      }

      // ── Messages ─────────────────────────────────────────────────────────
      const thread = db.insert(chatThreads).values({
        clientId: cid,
        name: "Care Team",
        members: JSON.stringify([demoUser.id, demoCG.id]),
        createdByUserId: demoUser.id,
        isOpen: true,
        createdAt: fmt(-5),
      }).returning().get();

      const msgData = [
        { senderId: demoCG.id, content: "Good morning! Just checked in on Donnie — he had a restful night and is in good spirits. Blood sugar was 108 this morning, right in range.", sentAt: fmt(-1, 7, 45) },
        { senderId: demoUser.id, content: "That's great to hear, Sarah. Thank you. Did he take the Donepezil okay? He's been resistant the last couple of mornings.", sentAt: fmt(-1, 8, 2) },
        { senderId: demoCG.id, content: "Yes — took it with breakfast no problem today. I think having the eggs ready first helped. He was hungry and in a better mood.", sentAt: fmt(-1, 8, 10) },
        { senderId: demoUser.id, content: "Smart thinking. I'll remember that. Don't forget we have the neurology appointment Thursday at 10:30. I'll handle the transport.", sentAt: fmt(-1, 8, 15) },
        { senderId: demoCG.id, content: "Got it — I'll make sure the care log and med list are printed and ready for you the night before. Is the whole family coming?", sentAt: fmt(-1, 8, 22) },
        { senderId: demoUser.id, content: "Just me and my sister. We'll probably grab lunch with Dad after if he's up for it.", sentAt: fmt(-1, 8, 30) },
        { senderId: demoCG.id, content: "He'll love that. He mentioned your names twice yesterday — good days.", sentAt: fmt(-1, 8, 35) },
        { senderId: demoCG.id, content: "Quick note — he refused the shower this morning. Didn't push it, washed up at the sink instead. Will try again this afternoon.", sentAt: fmt(0, 9, 25), priority: 'important' },
        { senderId: demoUser.id, content: "Understood. If he's still resistant this afternoon, that's okay — tomorrow morning with music on usually works better.", sentAt: fmt(0, 9, 40) },
      ];
      for (const m of msgData) {
        db.insert(messages).values({ threadId: thread.id, messageType: "text", isRead: false, readByUserIds: "[]", ...m } as any).run();
      }

      res.json({
        success: true,
        message: "Demo account seeded successfully",
        credentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
        clientId: cid,
        userId: demoUser.id,
        cgUserId: demoCG.id,
      });
    } catch (err: any) {
      console.error("Demo seed error:", err);
      res.status(500).json({ message: err?.message });
    }
  });

  // GET /api/demo/status — returns { isDemo: true } if current session is the demo account
  app.get("/api/demo/status", requireAuth, (req: any, res) => {
    const isDemoAccount = req.authAccount?.email === DEMO_EMAIL;
    res.json({ isDemo: isDemoAccount });
  });


}
