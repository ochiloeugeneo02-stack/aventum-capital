import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { RegisterUserBody, LoginUserBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword, requireAuth } from "../lib/auth";
import { createAuditLog } from "../lib/auditLog";
import { sendPasswordResetEmail, sendOtpEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

// ─── Signed 2FA token helpers (bypasses cookie/session for the OTP handoff) ──

function get2faSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not set");
  return secret;
}

function sign2faToken(payload: { userId: number; otp: string; expiry: number }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", get2faSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verify2faToken(token: string): { userId: number; otp: string; expiry: number } | null {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const expected = crypto.createHmac("sha256", get2faSecret()).update(data).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username ?? null,
    role: u.role,
    organizationId: u.organizationId ?? null,
    phoneNumber: u.phoneNumber ?? null,
    location: u.location ?? null,
    emailMarketing: u.emailMarketing,
    isActive: u.isActive,
    motivation: u.motivation ?? null,
    twoFactorEnabled: u.twoFactorEnabled,
    createdAt: u.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", message: parsed.error.message });
    return;
  }

  const { name, email, username, password, role, motivation, phoneNumber, location, emailMarketing } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username?.trim().toLowerCase();

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  if (username) {
    const existingUsername = await db.select().from(usersTable).where(eq(usersTable.username, normalizedUsername ?? username)).limit(1);
    if (existingUsername.length > 0) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    name,
    email: normalizedEmail,
    username: normalizedUsername ?? null,
    passwordHash,
    role: role ?? "member",
    motivation: motivation ?? null,
    phoneNumber: phoneNumber ?? null,
    location: location ?? null,
    emailMarketing: emailMarketing ?? false,
  }).returning();

  req.session.userId = user.id;
  req.session.userRole = user.role;

  await createAuditLog({ action: "user.register", performedBy: user.id, targetType: "user", targetId: user.id });

  res.status(201).json({ user: formatUser(user), message: "Account created successfully" });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", message: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const rawLoginIdentifier = email.trim().toLowerCase();
  const loginIdentifier = rawLoginIdentifier === "thewave" ? "thewave.grpevents@gmail.com" : rawLoginIdentifier;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.email, loginIdentifier), eq(usersTable.username, loginIdentifier)))
    .limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.twoFactorEnabled) {
    const otp = generateOtp();
    const expiry = Date.now() + 10 * 60 * 1000;
    const twoFactorToken = sign2faToken({ userId: user.id, otp, expiry });

    await sendOtpEmail({ email: user.email, name: user.name, otp, purpose: "login" });
    logger.info({ userId: user.id }, "2FA OTP sent for login");

    res.json({ requiresTwoFactor: true, emailHint: maskEmail(user.email), twoFactorToken });
    return;
  }

  req.session.userId = user.id;
  req.session.userRole = user.role;

  await createAuditLog({ action: "user.login", performedBy: user.id, targetType: "user", targetId: user.id });
  res.json({ user: formatUser(user), message: "Login successful" });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.json({ success: true, message: "Logged out successfully" });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(formatUser(user));
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);

  if (user && user.isActive) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await db.update(usersTable).set({
      passwordResetToken: token,
      passwordResetTokenExpiry: expiry,
    }).where(eq(usersTable.id, user.id));

    const appBaseUrl = process.env.APP_BASE_URL
      ?? (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : null)
      ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:3000");

    await sendPasswordResetEmail({ email: user.email, name: user.name, token, appBaseUrl });
    logger.info({ userId: user.id }, "Password reset token generated");
  }

  res.json({ message: "If that email is registered, a reset link has been sent." });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body;
  if (!token || !password || typeof token !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Token and password are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.passwordResetToken, token)).limit(1);

  if (!user || !user.passwordResetTokenExpiry || user.passwordResetTokenExpiry < new Date()) {
    res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
    return;
  }

  const passwordHash = await hashPassword(password);
  await db.update(usersTable).set({
    passwordHash,
    passwordResetToken: null,
    passwordResetTokenExpiry: null,
  }).where(eq(usersTable.id, user.id));

  logger.info({ userId: user.id }, "Password reset successfully");
  res.json({ message: "Password reset successfully. You can now log in." });
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current and new password are required" });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));

  res.json({ message: "Password changed successfully" });
});

// ─── Two-Factor Authentication (Email OTP) ───────────────────────────────────

router.post("/auth/2fa/validate", async (req, res): Promise<void> => {
  const { code, twoFactorToken } = req.body;

  if (!twoFactorToken || typeof twoFactorToken !== "string") {
    res.status(400).json({ error: "Missing 2FA token" });
    return;
  }
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Code is required" });
    return;
  }

  const payload = verify2faToken(twoFactorToken);
  if (!payload) {
    res.status(400).json({ error: "Invalid or tampered 2FA token" });
    return;
  }

  if (Date.now() > payload.expiry) {
    res.status(400).json({ error: "Code has expired. Please sign in again." });
    return;
  }

  if (code.replace(/\s/g, "") !== payload.otp) {
    res.status(401).json({ error: "Invalid code. Please try again." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }

  req.session.userId = user.id;
  req.session.userRole = user.role;

  logger.info({ userId: user.id }, "2FA validated, session created");
  await createAuditLog({ action: "user.login", performedBy: user.id, targetType: "user", targetId: user.id });
  res.json({ user: formatUser(user), message: "Login successful" });
});

router.post("/auth/2fa/resend", async (req, res): Promise<void> => {
  const { twoFactorToken } = req.body;

  if (!twoFactorToken || typeof twoFactorToken !== "string") {
    res.status(400).json({ error: "Missing 2FA token" });
    return;
  }

  const payload = verify2faToken(twoFactorToken);
  if (!payload) {
    res.status(400).json({ error: "Invalid or tampered 2FA token" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }

  const otp = generateOtp();
  const expiry = Date.now() + 10 * 60 * 1000;
  const newToken = sign2faToken({ userId: user.id, otp, expiry });

  await sendOtpEmail({ email: user.email, name: user.name, otp, purpose: "login" });
  logger.info({ userId: user.id }, "2FA OTP resent");

  res.json({ message: "A new code has been sent to your email.", twoFactorToken: newToken });
});

router.post("/auth/2fa/request", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const otp = generateOtp();
  req.session.twoFactorOtp = otp;
  req.session.twoFactorOtpExpiry = Date.now() + 10 * 60 * 1000;

  await sendOtpEmail({ email: user.email, name: user.name, otp, purpose: "enable_2fa" });
  logger.info({ userId: user.id }, "2FA enable OTP sent");

  res.json({ sent: true, emailHint: maskEmail(user.email) });
});

router.post("/auth/2fa/enable", requireAuth, async (req, res): Promise<void> => {
  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Verification code is required" });
    return;
  }

  if (!req.session.twoFactorOtp || !req.session.twoFactorOtpExpiry) {
    res.status(400).json({ error: "No pending code. Please request a new one." });
    return;
  }

  if (Date.now() > req.session.twoFactorOtpExpiry) {
    res.status(400).json({ error: "Code has expired. Please request a new one." });
    return;
  }

  if (code.replace(/\s/g, "") !== req.session.twoFactorOtp) {
    res.status(400).json({ error: "Invalid code" });
    return;
  }

  delete req.session.twoFactorOtp;
  delete req.session.twoFactorOtpExpiry;

  await db.update(usersTable).set({ twoFactorEnabled: true }).where(eq(usersTable.id, req.session.userId!));

  logger.info({ userId: req.session.userId }, "2FA enabled");
  res.json({ message: "Two-factor authentication enabled successfully" });
});

router.post("/auth/2fa/disable", requireAuth, async (req, res): Promise<void> => {
  const { password } = req.body;
  if (!password) { res.status(400).json({ error: "Password is required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) { res.status(400).json({ error: "Incorrect password" }); return; }

  await db.update(usersTable).set({ twoFactorEnabled: false }).where(eq(usersTable.id, user.id));

  logger.info({ userId: user.id }, "2FA disabled");
  res.json({ message: "Two-factor authentication disabled" });
});

export default router;
