import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  if (username) {
    const existingUsername = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (existingUsername.length > 0) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    name,
    email,
    username: username ?? null,
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

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
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
    req.session.pending2fa = true;
    req.session.pending2faUserId = user.id;
    req.session.twoFactorOtp = otp;
    req.session.twoFactorOtpExpiry = Date.now() + 10 * 60 * 1000;

    await sendOtpEmail({ email: user.email, name: user.name, otp, purpose: "login" });
    logger.info({ userId: user.id }, "2FA OTP sent for login");

    res.json({ requiresTwoFactor: true, emailHint: maskEmail(user.email) });
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
  if (!req.session.pending2fa || !req.session.pending2faUserId) {
    res.status(400).json({ error: "No pending 2FA session" });
    return;
  }

  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Code is required" });
    return;
  }

  if (!req.session.twoFactorOtp || !req.session.twoFactorOtpExpiry) {
    res.status(400).json({ error: "No OTP found. Please request a new code." });
    return;
  }

  if (Date.now() > req.session.twoFactorOtpExpiry) {
    res.status(400).json({ error: "Code has expired. Please request a new one." });
    return;
  }

  if (code.replace(/\s/g, "") !== req.session.twoFactorOtp) {
    res.status(401).json({ error: "Invalid code. Please try again." });
    return;
  }

  const userId = req.session.pending2faUserId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }

  delete req.session.pending2fa;
  delete req.session.pending2faUserId;
  delete req.session.twoFactorOtp;
  delete req.session.twoFactorOtpExpiry;

  req.session.userId = user.id;
  req.session.userRole = user.role;

  await createAuditLog({ action: "user.login", performedBy: user.id, targetType: "user", targetId: user.id });
  res.json({ user: formatUser(user), message: "Login successful" });
});

router.post("/auth/2fa/resend", async (req, res): Promise<void> => {
  if (!req.session.pending2fa || !req.session.pending2faUserId) {
    res.status(400).json({ error: "No pending 2FA session" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.pending2faUserId)).limit(1);
  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }

  const otp = generateOtp();
  req.session.twoFactorOtp = otp;
  req.session.twoFactorOtpExpiry = Date.now() + 10 * 60 * 1000;

  await sendOtpEmail({ email: user.email, name: user.name, otp, purpose: "login" });
  logger.info({ userId: user.id }, "2FA OTP resent");

  res.json({ message: "A new code has been sent to your email." });
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
