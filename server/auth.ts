/**
 * Care Net Portal — Auth Layer
 * JWT-based sessions, bcrypt passwords, 30-day expiry
 * Sensitive-action re-auth gate for doctor notes / medication changes
 */

import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { db } from "./db";
import { authAccounts, authSessions, users, userClientRelationships } from "../shared/schema";
import { eq, and, gt } from "drizzle-orm";

// ── Admin identity ─────────────────────────────────────────────────────────
// David (user 12) and Becky (user 11) are the only admins.
// Auth checks by user ID — not email — to avoid spoofing.
// Admin user IDs: Becky (11 = blgservantgirl@gmail.com, 43 = beckylgould01@gmail.com) + David (12 = davidpromail@yahoo.com)
const ADMIN_USER_IDS = new Set([10, 11, 12, 43]); // 10=David (gouldenterprises), 11=Becky, 12=davidpromail, 43=Becky test

// ── Constants ─────────────────────────────────────────────────────────────

const JWT_SECRET_RAW = process.env.JWT_SECRET;
// Warn loudly if missing in production, but do not exit at module load time.
// Railway injects env vars before the server starts, but process.exit() at
// module scope can fire before the runtime is fully initialised.
if (!JWT_SECRET_RAW && process.env.NODE_ENV === "production") {
  console.error("[FATAL] JWT_SECRET environment variable is not set in production. All token operations will fail.");
}
const JWT_SECRET = new TextEncoder().encode(
  JWT_SECRET_RAW || "care-net-dev-secret-change-in-production-min-32-chars"
);
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 12;

// ── Password helpers ──────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Token helpers ─────────────────────────────────────────────────────────

export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ── JWT session ───────────────────────────────────────────────────────────

export async function createJWT(authAccountId: number): Promise<{ token: string; jti: string }> {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const token = await new SignJWT({ authAccountId })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(JWT_SECRET);

  return { token, jti };
}

export async function verifyJWT(token: string): Promise<{ authAccountId: number; jti: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      authAccountId: payload.authAccountId as number,
      jti: payload.jti as string,
    };
  } catch {
    return null;
  }
}

// ── Session persistence ───────────────────────────────────────────────────

export async function createSession(
  authAccountId: number,
  req: Request
): Promise<string> {
  const { token, jti } = await createJWT(authAccountId);
  const tokenHash = hashToken(jti);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.insert(authSessions).values({
    authAccountId,
    tokenHash,
    expiresAt,
    createdAt: new Date().toISOString(),
    userAgent: req.headers["user-agent"] || null,
    ipAddress: req.ip || null,
  }).run();

  // Update last login
  db.update(authAccounts)
    .set({ lastLoginAt: new Date().toISOString() })
    .where(eq(authAccounts.id, authAccountId))
    .run();

  return token;
}

export function revokeSession(jti: string): void {
  const tokenHash = hashToken(jti);
  db.update(authSessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(authSessions.tokenHash, tokenHash))
    .run();
}

// ── Cookie helpers ────────────────────────────────────────────────────────

const COOKIE_NAME = "cn_session";

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function getTokenFromRequest(req: Request): string | null {
  // Try Authorization header first — explicit token always wins over ambient cookie.
  // This ensures admin panel login (Bearer) is not shadowed by an existing portal cookie.
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  // Fallback: httpOnly cookie (standard web app sessions)
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  return null;
}

// ── Auth middleware ───────────────────────────────────────────────────────

export interface AuthRequest extends Request {
  authAccountId?: number;
  authUserId?: number;       // the portal users.id linked to this account
  authUserRole?: string;
  authJti?: string;
  isDemoMode?: boolean;
}

/**
 * requireAuth — blocks unauthenticated requests
 * In DEMO MODE (no JWT_SECRET set to production value), allows demo users through.
 */
export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // DEMO MODE: if request carries x-demo-user header, allow through with demo identity
  // This lets the existing demo switcher keep working during dev
  const demoUserId = req.headers["x-demo-user-id"];
  if (process.env.DEMO_MODE === "true" && demoUserId) {
    req.isDemoMode = true;
    req.authUserId = parseInt(demoUserId as string, 10);
    const u = db.select().from(users).where(eq(users.id, req.authUserId)).get();
    req.authUserRole = u?.role || "caregiver";
    return next();
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    clearSessionCookie(res);
    res.status(401).json({ message: "Session expired" });
    return;
  }

  // Check session hasn't been revoked
  const tokenHash = hashToken(payload.jti);
  const session = db.select().from(authSessions).where(
    and(
      eq(authSessions.tokenHash, tokenHash),
      eq(authSessions.authAccountId, payload.authAccountId)
    )
  ).get();

  if (!session || session.revokedAt) {
    clearSessionCookie(res);
    res.status(401).json({ message: "Session revoked" });
    return;
  }

  // Check not expired
  if (new Date(session.expiresAt) < new Date()) {
    clearSessionCookie(res);
    res.status(401).json({ message: "Session expired" });
    return;
  }

  // Load linked portal user
  const account = db.select().from(authAccounts).where(eq(authAccounts.id, payload.authAccountId)).get();
  if (!account?.userId) {
    res.status(403).json({ message: "Account not yet activated" });
    return;
  }

  const user = db.select().from(users).where(eq(users.id, account.userId)).get();
  if (!user) {
    res.status(403).json({ message: "User not found" });
    return;
  }

  // Enforce isActive — deactivated users cannot use any authenticated route
  if (user.isActive === false) {
    clearSessionCookie(res);
    res.status(403).json({ message: "Account has been deactivated" });
    return;
  }

  req.authAccountId = payload.authAccountId;
  req.authJti = payload.jti;
  req.authUserId = user.id;
  req.authUserRole = user.role;

  // Refresh last_login_at if it hasn't been updated in the last hour
  // This ensures users with long-lived sessions still show as recently active
  const lastLogin = account.lastLoginAt ? new Date(account.lastLoginAt).getTime() : 0;
  if (Date.now() - lastLogin > 60 * 60 * 1000) {
    db.update(authAccounts)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(authAccounts.id, payload.authAccountId))
      .run();
  }

  next();
}

/**
 * requireAdmin — blocks anyone who is not David (12) or Becky (11).
 * Must be used after requireAuth so req.authUserId is populated.
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUserId || !ADMIN_USER_IDS.has(req.authUserId)) {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
}

/**
 * requirePortalAccess — verifies the authenticated user belongs to the
 * portal identified by clientId (from req.params or req.body).
 * Checks user_client_relationships OR users.clientId for legacy compatibility.
 * MCs, caregivers, and family members all pass if they have a relationship row.
 * Admins always pass.
 */
export function requirePortalAccess(getClientId: (req: AuthRequest) => number | undefined) {
  return function (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void {
    // Admins bypass portal access checks
    if (req.authUserId && ADMIN_USER_IDS.has(req.authUserId)) {
      return next();
    }

    const clientId = getClientId(req);
    if (!clientId || isNaN(clientId)) {
      res.status(400).json({ message: "Invalid portal identifier" });
      return;
    }

    if (!req.authUserId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    // Check user_client_relationships first (authoritative)
    const rel = db.select().from(userClientRelationships)
      .where(and(
        eq(userClientRelationships.userId, req.authUserId),
        eq(userClientRelationships.clientId, clientId)
      ))
      .get();

    if (rel) return next();

    // Fallback: legacy users.clientId
    const user = db.select().from(users).where(eq(users.id, req.authUserId)).get();
    if (user?.clientId === clientId) return next();

    res.status(403).json({ message: "Access to this portal is not authorized" });
  };
}

/**
 * checkPortalAccess — imperative (non-middleware) version of requirePortalAccess.
 * Use inside route handlers when the clientId is derived from a loaded record,
 * not directly from req.params.
 * Returns true if the user is allowed to access the portal, false otherwise.
 */
export function checkPortalAccess(req: AuthRequest, clientId: number): boolean {
  if (!req.authUserId) return false;
  // Admins always pass
  if (ADMIN_USER_IDS.has(req.authUserId)) return true;

  // Check relationship table
  const rel = db.select().from(userClientRelationships)
    .where(and(
      eq(userClientRelationships.userId, req.authUserId),
      eq(userClientRelationships.clientId, clientId)
    ))
    .get();
  if (rel) return true;

  // Legacy fallback
  const user = db.select().from(users).where(eq(users.id, req.authUserId)).get();
  return user?.clientId === clientId;
}

/**
 * requireAuthAccount — lighter version of requireAuth.
 * Validates JWT + active session but does NOT require account.userId to be set.
 * Use for onboarding routes where the user row doesn't exist yet.
 */
export async function requireAuthAccount(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // DEMO MODE bypass
  const demoUserId = req.headers["x-demo-user-id"];
  if (process.env.DEMO_MODE === "true" && demoUserId) {
    req.isDemoMode = true;
    req.authUserId = parseInt(demoUserId as string, 10);
    const u = db.select().from(users).where(eq(users.id, req.authUserId)).get();
    req.authUserRole = u?.role || "caregiver";
    return next();
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    clearSessionCookie(res);
    res.status(401).json({ message: "Session expired" });
    return;
  }

  // Check session is active and not revoked
  const tokenHash = hashToken(payload.jti);
  const session = db.select().from(authSessions).where(
    and(
      eq(authSessions.tokenHash, tokenHash),
      eq(authSessions.authAccountId, payload.authAccountId)
    )
  ).get();

  if (!session || session.revokedAt) {
    clearSessionCookie(res);
    res.status(401).json({ message: "Session revoked" });
    return;
  }

  if (new Date(session.expiresAt) < new Date()) {
    clearSessionCookie(res);
    res.status(401).json({ message: "Session expired" });
    return;
  }

  // Account must exist, but userId is NOT required (new users don't have it yet)
  const account = db.select().from(authAccounts).where(eq(authAccounts.id, payload.authAccountId)).get();
  if (!account) {
    res.status(401).json({ message: "Account not found" });
    return;
  }

  req.authAccountId = payload.authAccountId;
  req.authJti = payload.jti;
  // authUserId may be undefined here — that's fine for onboarding
  if (account.userId) {
    req.authUserId = account.userId;
    const u = db.select().from(users).where(eq(users.id, account.userId)).get();
    req.authUserRole = u?.role || "caregiver";
  }
  next();
}

/**
 * requireReAuth — for sensitive actions (doctor notes, med changes)
 * Checks X-Reauth-Password header against stored hash
 */
export async function requireReAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip re-auth in demo mode
  if (req.isDemoMode) return next();

  const password = req.headers["x-reauth-password"] as string;
  if (!password) {
    res.status(403).json({ message: "Re-authentication required", requiresReauth: true });
    return;
  }

  const account = db.select().from(authAccounts)
    .where(eq(authAccounts.id, req.authAccountId!))
    .get();

  if (!account) {
    res.status(403).json({ message: "Account not found" });
    return;
  }

  const valid = await verifyPassword(password, account.passwordHash);
  if (!valid) {
    res.status(403).json({ message: "Incorrect password", requiresReauth: true });
    return;
  }

  next();
}

// ── Email helper (Resend / console fallback) ─────────────────────────────

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.SMTP_FROM || "Care Net Portal <onboarding@resend.dev>";
    // Strip HTML tags for plain-text fallback (spam filters require both versions)
    const text = opts.html
      .replace(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, "$2: $1")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const result = await resend.emails.send({
      from,
      to: opts.to,
      replyTo: "Care Net Portal <portal@carenetportal.com>",
      subject: opts.subject,
      html: opts.html,
      text,
    });
    if (result.error) throw new Error(result.error.message);
  } else {
    // Dev fallback — log to console
    console.log("\n📧 EMAIL (dev mode — no email service configured)");
    console.log(`  To: ${opts.to}`);
    console.log(`  Subject: ${opts.subject}`);
    console.log(`  Body: ${opts.html.replace(/<[^>]+>/g, "").substring(0, 300)}`);
    console.log("---\n");
  }
}

// ── Email templates ───────────────────────────────────────────────────────

export function emailApprovalTemplate(name: string, inviteUrl: string): string {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #1a5f5a; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Care Net Portal</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">Private Beta</p>
      </div>
      <div style="background: #fafaf9; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e5e3; border-top: none;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">Welcome, ${name}</h2>
        <p style="color: #4a4a48; line-height: 1.6; margin: 0 0 24px;">
          Your Care Net Portal beta application has been approved. We're grateful you're willing to help shape this — it means a lot.
        </p>
        <p style="color: #4a4a48; line-height: 1.6; margin: 0 0 24px;">
          Click the button below to set up your account. This link expires in <strong>48 hours</strong>.
        </p>
        <a href="${inviteUrl}" style="display: inline-block; background: #1a5f5a; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px;">
          Set Up My Account →
        </a>
        <p style="color: #9a9a98; font-size: 13px; margin: 24px 0 0; line-height: 1.5;">
          A reminder that this is a private beta. Please don't share screenshots or describe the platform publicly — we'll open things up on our own timeline. Thank you for respecting that.
        </p>
      </div>
    </div>
  `;
}

export function emailApprovalWelcomeTemplate(name: string, loginUrl: string): string {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #1a5f5a; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Care Net Portal</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">Private Beta</p>
      </div>
      <div style="background: #fafaf9; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e5e3; border-top: none;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">You're in, ${name}!</h2>
        <p style="color: #4a4a48; line-height: 1.6; margin: 0 0 24px;">
          Your Care Net Portal account is set up and ready to go. We're grateful you're willing to help shape this — it means a lot.
        </p>
        <p style="color: #4a4a48; line-height: 1.6; margin: 0 0 24px;">
          Click the button below to sign in any time.
        </p>
        <a href="${loginUrl}" style="display: inline-block; background: #1a5f5a; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px;">
          Sign In to Care Net Portal →
        </a>
        <p style="color: #9a9a98; font-size: 13px; margin: 24px 0 0; line-height: 1.5;">
          This is a private beta. Please don't share screenshots or describe the platform publicly — we'll open things up on our own timeline. Thank you for respecting that.
        </p>
        <p style="color: #9a9a98; font-size: 13px; margin: 12px 0 0;">
          Questions? Reply to this email or reach us at portal@carenetportal.com.
        </p>
      </div>
    </div>
  `;
}

export function emailDenialTemplate(name: string): string {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #1a5f5a; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Care Net Portal</h1>
      </div>
      <div style="background: #fafaf9; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e5e3; border-top: none;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">Hi ${name},</h2>
        <p style="color: #4a4a48; line-height: 1.6; margin: 0 0 24px;">
          Thank you for your interest in Care Net Portal. We're keeping the current beta very small and focused, and unfortunately we're not able to include your application at this time.
        </p>
        <p style="color: #4a4a48; line-height: 1.6; margin: 0;">
          We'll keep your information on file — as we expand access, we'll reach out if we think you'd be a good fit.
        </p>
      </div>
    </div>
  `;
}

export function emailVerifyTemplate(name: string, verifyUrl: string): string {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #1a5f5a; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Care Net Portal</h1>
      </div>
      <div style="background: #fafaf9; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e5e3; border-top: none;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">Verify your email, ${name}</h2>
        <p style="color: #4a4a48; line-height: 1.6; margin: 0 0 24px;">
          Click below to verify your email address and activate your Care Net Portal account.
        </p>
        <a href="${verifyUrl}" style="display: inline-block; background: #1a5f5a; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px;">
          Verify Email →
        </a>
        <p style="color: #9a9a98; font-size: 13px; margin: 24px 0 0;">
          This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;
}

export function emailPasswordResetTemplate(name: string, resetUrl: string): string {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #1a5f5a; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Care Net Portal</h1>
      </div>
      <div style="background: #fafaf9; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e5e3; border-top: none;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">Reset your password, ${name}</h2>
        <p style="color: #4a4a48; line-height: 1.6; margin: 0 0 24px;">
          We received a request to reset the password for your Care Net Portal account. Click below to set a new one.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #1a5f5a; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px;">
          Reset Password →
        </a>
        <p style="color: #9a9a98; font-size: 13px; margin: 24px 0 0;">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;
}
