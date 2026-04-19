import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterUserBody, LoginUserBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword, requireAuth } from "../lib/auth";
import { createAuditLog } from "../lib/auditLog";
import { sendPasswordResetEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { authenticator } from "otplib";
import QRCode from "qrcode";

const router: IRouter = Router();

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

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    req.session.pending2fa = true;
    req.session.pending2faUserId = user.id;
    res.json({ requiresTwoFactor: true });
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

// ─── Two-Factor Authentication ────────────────────────────────────────────────

router.get("/auth/2fa/setup", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, "Aventum Capital", secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  const backupCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );

  await db.update(usersTable).set({ twoFactorSecret: secret }).where(eq(usersTable.id, user.id));

  res.json({ secret, qrDataUrl, backupCodes });
});

router.post("/auth/2fa/enable", requireAuth, async (req, res): Promise<void> => {
  const { code, backupCodes } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Verification code is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (!user || !user.twoFactorSecret) {
    res.status(400).json({ error: "2FA setup not initiated" });
    return;
  }

  const { authenticator } = await import("otplib");
  const valid = authenticator.verify({ token: code.replace(/\s/g, ""), secret: user.twoFactorSecret });
  if (!valid) {
    res.status(400).json({ error: "Invalid verification code" });
    return;
  }

  const hashedBackups = Array.isArray(backupCodes)
    ? backupCodes.map((c: string) => crypto.createHash("sha256").update(c).digest("hex"))
    : [];

  await db.update(usersTable).set({
    twoFactorEnabled: true,
    twoFactorBackupCodes: JSON.stringify(hashedBackups),
  }).where(eq(usersTable.id, user.id));

  logger.info({ userId: user.id }, "2FA enabled");
  res.json({ message: "Two-factor authentication enabled successfully" });
});

router.post("/auth/2fa/disable", requireAuth, async (req, res): Promise<void> => {
  const { password } = req.body;
  if (!password) { res.status(400).json({ error: "Password is required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) { res.status(400).json({ error: "Incorrect password" }); return; }

  await db.update(usersTable).set({
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: null,
  }).where(eq(usersTable.id, user.id));

  logger.info({ userId: user.id }, "2FA disabled");
  res.json({ message: "Two-factor authentication disabled" });
});

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

  const userId = req.session.pending2faUserId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || !user.twoFactorSecret) {
    res.status(400).json({ error: "Invalid session" });
    return;
  }

  const cleanCode = code.replace(/\s/g, "");
  const { authenticator } = await import("otplib");
  const validTotp = authenticator.verify({ token: cleanCode, secret: user.twoFactorSecret });

  if (!validTotp) {
    const storedBackups: string[] = user.twoFactorBackupCodes ? JSON.parse(user.twoFactorBackupCodes) : [];
    const hashedInput = crypto.createHash("sha256").update(cleanCode).digest("hex");
    const backupIndex = storedBackups.indexOf(hashedInput);

    if (backupIndex === -1) {
      res.status(401).json({ error: "Invalid code" });
      return;
    }

    storedBackups.splice(backupIndex, 1);
    await db.update(usersTable).set({ twoFactorBackupCodes: JSON.stringify(storedBackups) }).where(eq(usersTable.id, user.id));
    logger.info({ userId: user.id }, "2FA backup code used");
  }

  delete req.session.pending2fa;
  delete req.session.pending2faUserId;
  req.session.userId = user.id;
  req.session.userRole = user.role;

  await createAuditLog({ action: "user.login", performedBy: user.id, targetType: "user", targetId: user.id });

  res.json({ user: formatUser(user), message: "Login successful" });
});

export default router;
