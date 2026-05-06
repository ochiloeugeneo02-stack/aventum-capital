import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { db, usersTable, securityQuestionsTable, unlockRequestsTable } from "@workspace/db";
import { eq, or, inArray, and } from "drizzle-orm";
import { RegisterUserBody, LoginUserBody } from "@workspace/api-zod";
import zod from "zod";
import { hashPassword, verifyPassword, requireAuth, isStaffRole } from "../lib/auth";
import { createAuditLog } from "../lib/auditLog";
import { sendPasswordResetEmail, sendOtpEmail, sendWelcomeEmail, sendUnlockRequestNotification } from "../lib/email";
import { logger } from "../lib/logger";
import { getAppBaseUrl } from "../lib/appUrl";

const router: IRouter = Router();

const MAX_FAILED_ATTEMPTS = 5;

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

/** Short-lived signed token issued by the security-questions GET endpoint.
 *  Required by the verify endpoint to prevent cross-session brute-forcing. */
function signRecoveryToken(userId: number): string {
  const payload = { userId, expiry: Date.now() + 15 * 60 * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", get2faSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyRecoveryToken(token: string): { userId: number; expiry: number } | null {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const expected = crypto.createHmac("sha256", get2faSecret()).update(data).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "base64url"), Buffer.from(expected, "base64url"))) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as { userId: number; expiry: number };
    if (Date.now() > payload.expiry) return null;
    return payload;
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
    avatar: u.avatar ?? null,
    departmentId: u.departmentId ?? null,
    twoFactorEnabled: u.twoFactorEnabled,
    isFinanceAdmin: u.isFinanceAdmin,
    securityQuestionsSet: u.securityQuestionsSet,
    requiresPasswordReset: u.requiresPasswordReset,
    createdAt: u.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", message: parsed.error.message });
    return;
  }

  const { name, email, password, username, motivation, phoneNumber, location, emailMarketing } = parsed.data;
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
  // Role is always forced to "member" server-side; privileged roles must be
  // assigned through the admin role-change approval workflow.
  const [user] = await db.insert(usersTable).values({
    name,
    email: normalizedEmail,
    username: normalizedUsername ?? null,
    passwordHash,
    role: "member",
    motivation: motivation ?? null,
    phoneNumber: phoneNumber ?? null,
    location: location ?? null,
    emailMarketing: emailMarketing ?? false,
  }).returning();

  req.session.userId = user.id;
  req.session.userRole = user.role;

  await createAuditLog({ action: "user.register", performedBy: user.id, targetType: "user", targetId: user.id });

  Promise.resolve().then(() =>
    sendWelcomeEmail({ email: user.email, name: user.name, appBaseUrl: getAppBaseUrl(req) }).catch(() => {})
  );

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

  const userIsStaff = isStaffRole(user.role);

  // Lockout only applies to staff accounts (employee portal hardening requirement).
  // Non-staff members use standard wrong-password messaging without lockout.
  if (userIsStaff && user.lockedAt) {
    const challengeToken = crypto.randomUUID();
    req.session.recoveryChallenge = { token: challengeToken, email: user.email };
    // Return canonical email so frontend recovery flow always uses the correct address
    // (staff may log in with a username alias; the recovery endpoint is keyed by email)
    res.status(423).json({ error: "accountLocked", recoveryChallenge: challengeToken, canonicalEmail: user.email, message: "Your account has been locked due to too many failed login attempts. Please answer your security questions to request an unlock." });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    if (userIsStaff) {
      const newAttempts = (user.failedLoginAttempts ?? 0) + 1;
      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        await db.update(usersTable).set({ failedLoginAttempts: newAttempts, lockedAt: new Date() }).where(eq(usersTable.id, user.id));
        logger.warn({ userId: user.id }, "Staff account locked after too many failed attempts");
        const challengeToken = crypto.randomUUID();
        req.session.recoveryChallenge = { token: challengeToken, email: user.email };
        res.status(423).json({ error: "accountLocked", recoveryChallenge: challengeToken, canonicalEmail: user.email, message: "Your account has been locked after too many failed attempts. Please answer your security questions to request an unlock." });
      } else {
        await db.update(usersTable).set({ failedLoginAttempts: newAttempts }).where(eq(usersTable.id, user.id));
        res.status(401).json({ error: "Invalid credentials", attemptsRemaining: MAX_FAILED_ATTEMPTS - newAttempts });
      }
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
    return;
  }

  // Reset failed attempts on successful password match
  if ((user.failedLoginAttempts ?? 0) > 0) {
    await db.update(usersTable).set({ failedLoginAttempts: 0 }).where(eq(usersTable.id, user.id));
  }

  // OTP is mandatory for all logins
  const otp = generateOtp();
  const expiry = Date.now() + 10 * 60 * 1000;
  const twoFactorToken = sign2faToken({ userId: user.id, otp, expiry });

  await sendOtpEmail({ email: user.email, name: user.name, otp, purpose: "login" });
  logger.info({ userId: user.id }, "Login OTP sent");
  if (isStaffRole(user.role)) {
    logger.warn({ userId: user.id, email: user.email }, "STAFF_OTP_FALLBACK: staff login OTP sent (check email delivery; OTP not logged for security)");
  }

  const otpResponse: Record<string, unknown> = {
    requiresTwoFactor: true,
    emailHint: maskEmail(user.email),
    twoFactorToken,
  };
  if (process.env.NODE_ENV !== "production") {
    otpResponse.testOtp = otp;
  }
  res.json(otpResponse);
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

  // Locked staff accounts may NOT self-unlock via forgot-password.
  // Only the admin-approved unlock workflow clears lockedAt and issues a reset token.
  const isLockedStaff = user && isStaffRole(user.role) && !!user.lockedAt;

  if (user && user.isActive && !isLockedStaff) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await db.update(usersTable).set({
      passwordResetToken: token,
      passwordResetTokenExpiry: expiry,
    }).where(eq(usersTable.id, user.id));

    await sendPasswordResetEmail({ email: user.email, name: user.name, token, appBaseUrl: getAppBaseUrl(req) });
    logger.info({ userId: user.id }, "Password reset token generated");
    if (isStaffRole(user.role)) {
      logger.warn({ userId: user.id, email: user.email }, "STAFF_RESET_FALLBACK: staff password reset email sent (token not logged)");
    }
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
  // For staff: lock state is cleared by the admin unlock approval flow BEFORE the reset token is
  // issued, so we must not clear it here — that would allow bypassing the unlock workflow.
  // For non-staff members, clear any residual lock state as a safety measure.
  const clearLock = !isStaffRole(user.role);
  await db.update(usersTable).set({
    passwordHash,
    passwordResetToken: null,
    passwordResetTokenExpiry: null,
    requiresPasswordReset: false,
    ...(clearLock ? { lockedAt: null, failedLoginAttempts: 0 } : {}),
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
  await db.update(usersTable).set({ passwordHash, requiresPasswordReset: false }).where(eq(usersTable.id, user.id));

  res.json({ message: "Password changed successfully" });
});

// ─── Security Questions ───────────────────────────────────────────────────────

// questionIndex is the catalog slot index (0–11, matching the fixed question catalog in the UI).
// It is stored as-is and returned to the verify endpoint, which matches answers by stored index.
const SecurityQuestionItemSchema = zod.object({
  questionIndex: zod.number().int().min(0).max(11),
  questionText: zod.string().min(5),
  answer: zod.string().min(2).max(200),
});
const SecurityQuestionsSetupBody = zod.object({
  questions: zod.array(SecurityQuestionItemSchema).length(3),
}).superRefine((data, ctx) => {
  const indices = data.questions.map(q => q.questionIndex);
  const texts = data.questions.map(q => q.questionText.trim().toLowerCase());
  if (new Set(indices).size !== indices.length) {
    ctx.addIssue({ code: zod.ZodIssueCode.custom, message: "All three questions must be distinct (duplicate questionIndex detected)", path: ["questions"] });
  }
  if (new Set(texts).size !== texts.length) {
    ctx.addIssue({ code: zod.ZodIssueCode.custom, message: "All three questions must be distinct (duplicate question text detected)", path: ["questions"] });
  }
});

const SecurityQuestionAnswerSchema = zod.object({
  questionIndex: zod.number().int().min(0).max(11),
  answer: zod.string().min(1).max(200),
});
const SecurityQuestionsVerifyBody = zod.object({
  recoveryToken: zod.string().min(1),
  answers: zod.array(SecurityQuestionAnswerSchema).length(3),
});

router.post("/auth/security-questions/setup", requireAuth, async (req, res): Promise<void> => {
  const parsed = SecurityQuestionsSetupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", message: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }
  const { questions } = parsed.data;

  const userId = req.session.userId!;

  // Remove existing questions for this user
  await db.delete(securityQuestionsTable).where(eq(securityQuestionsTable.userId, userId));

  // Hash and store the new answers
  const hashed = await Promise.all(
    questions.map(async (q) => ({
      userId,
      questionIndex: q.questionIndex,
      questionText: q.questionText,
      answerHash: await hashPassword(q.answer.trim().toLowerCase()),
    }))
  );

  await db.insert(securityQuestionsTable).values(hashed);
  await db.update(usersTable).set({ securityQuestionsSet: true }).where(eq(usersTable.id, userId));
  req.session.securityQuestionsSet = true;

  await createAuditLog({ action: "user.security_questions_set", performedBy: userId, targetType: "user", targetId: userId });
  logger.info({ userId }, "Security questions configured");

  res.json({ success: true, message: "Security questions saved successfully" });
});

const verifyRateLimit = new Map<string, { count: number; resetAt: number }>();
const MAX_VERIFY_ATTEMPTS = 5;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;

router.post("/auth/security-questions/verify", async (req, res): Promise<void> => {
  const clientKey = `${req.ip ?? "unknown"}`;
  const now = Date.now();
  const entry = verifyRateLimit.get(clientKey) ?? { count: 0, resetAt: now + VERIFY_WINDOW_MS };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + VERIFY_WINDOW_MS; }
  if (entry.count >= MAX_VERIFY_ATTEMPTS) {
    res.status(429).json({ error: "Too many verification attempts. Please wait 15 minutes before trying again." });
    return;
  }
  entry.count++;
  verifyRateLimit.set(clientKey, entry);

  const parsed = SecurityQuestionsVerifyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", message: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }
  const { recoveryToken, answers } = parsed.data;

  const tokenPayload = verifyRecoveryToken(recoveryToken);
  if (!tokenPayload) {
    res.status(400).json({ error: "Cannot process security question verification for this account" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, tokenPayload.userId)).limit(1);
  if (!user || !user.lockedAt) {
    res.status(400).json({ error: "Cannot process security question verification for this account" });
    return;
  }

  const storedQuestions = await db.select().from(securityQuestionsTable).where(eq(securityQuestionsTable.userId, user.id));
  if (storedQuestions.length < 3) {
    res.status(400).json({ error: "Security questions not configured for this account" });
    return;
  }

  // Enforce unique questionIndex values — no duplicates allowed
  const submittedIndices = answers.map((a) => a.questionIndex);
  const uniqueSubmitted = new Set(submittedIndices);
  if (uniqueSubmitted.size !== submittedIndices.length) {
    res.status(400).json({ error: "Duplicate question indices submitted. You must answer each question exactly once." });
    return;
  }

  // Enforce one-to-one match: submitted indices must exactly equal stored indices
  const storedIndices = new Set(storedQuestions.map((q) => q.questionIndex));
  const allMatch = submittedIndices.every((idx) => storedIndices.has(idx)) && uniqueSubmitted.size === storedIndices.size;
  if (!allMatch) {
    res.status(400).json({ error: "Submitted question indices do not match your configured security questions." });
    return;
  }

  // Verify all three answers one-to-one
  const verifyResults = await Promise.all(
    answers.map(async (a) => {
      const stored = storedQuestions.find((q) => q.questionIndex === a.questionIndex);
      if (!stored) return false;
      return verifyPassword(a.answer.trim().toLowerCase(), stored.answerHash);
    })
  );

  if (!verifyResults.every(Boolean)) {
    res.status(401).json({ error: "One or more answers are incorrect. Please try again." });
    return;
  }

  // Block duplicate pending unlock requests for the same user
  const existingPending = await db.select().from(unlockRequestsTable)
    .where(and(eq(unlockRequestsTable.userId, user.id), eq(unlockRequestsTable.status, "pending")))
    .limit(1);
  if (existingPending.length > 0) {
    res.json({ success: true, message: "An unlock request is already pending for your account. IT/Support will review it shortly." });
    return;
  }

  // Create unlock request
  const [unlockReq] = await db.insert(unlockRequestsTable).values({
    userId: user.id,
    status: "pending",
  }).returning();

  await createAuditLog({ action: "user.unlock_requested", performedBy: user.id, targetType: "user", targetId: user.id });

  // Notify IT/Support and CTO/System Admin staff (fire-and-forget with explicit error logging)
  Promise.resolve().then(async () => {
    try {
      const staffNotifyRoles = ["it_support", "cto_admin", "super_admin", "ceo"];
      const staffToNotify = await db.select().from(usersTable).where(inArray(usersTable.role, staffNotifyRoles));
      await Promise.all(
        staffToNotify.map((staff) =>
          sendUnlockRequestNotification({
            staffEmail: staff.email,
            staffName: staff.name,
            lockedUserName: user.name,
            lockedUserEmail: user.email,
            unlockRequestId: unlockReq.id,
            appBaseUrl: process.env.APP_BASE_URL ?? "",
          }).catch((emailErr) => { logger.warn({ error: emailErr, staffId: staff.id }, "Failed to send unlock notification email"); })
        )
      );
    } catch (notifyErr) {
      logger.warn({ error: notifyErr }, "Failed to send unlock request notifications");
    }
  });

  res.json({ success: true, message: "Your answers are correct. An unlock request has been sent to IT/Support. You will receive an email once your account is restored." });
});

router.get("/auth/security-questions/:email", async (req, res): Promise<void> => {
  const email = req.params.email?.toLowerCase().trim();
  if (!email) { res.status(400).json({ error: "Email is required" }); return; }

  // Require the session-bound recoveryChallenge issued by the login lockout response.
  // The challenge is scoped to a specific email so a token from one lockout cannot be
  // reused to fetch questions for a different locked account within the same session.
  const challenge = req.query.challenge as string | undefined;
  const stored = req.session.recoveryChallenge;
  if (!challenge || !stored || challenge !== stored.token || email !== stored.email.toLowerCase().trim()) {
    res.status(403).json({ error: "Invalid or missing recovery challenge. Please initiate recovery from the login screen." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  // Return same generic error for non-existent accounts and unlocked accounts (no enumeration)
  if (!user || !user.lockedAt) { res.status(400).json({ error: "Security questions are not available for this account" }); return; }

  const questions = await db.select({ questionIndex: securityQuestionsTable.questionIndex, questionText: securityQuestionsTable.questionText })
    .from(securityQuestionsTable)
    .where(eq(securityQuestionsTable.userId, user.id));

  // Issue a short-lived signed recovery token. The verify endpoint requires this
  // token, scoping each verification attempt to a single initiated recovery session.
  const recoveryToken = signRecoveryToken(user.id);

  // Note: userName is intentionally omitted to prevent account-info disclosure
  res.json({ questions, recoveryToken });
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

  // Enforce password reset before granting session — must happen before session is created
  if (user.requiresPasswordReset && user.passwordResetToken) {
    logger.info({ userId: user.id }, "Login blocked: password reset required after account unlock");
    res.json({
      passwordResetRequired: true,
      resetToken: user.passwordResetToken,
      message: "Your account has been unlocked. You must set a new password before you can log in.",
    });
    return;
  }

  req.session.userId = user.id;
  req.session.userRole = user.role;
  req.session.isFinanceAdmin = user.isFinanceAdmin ?? false;
  req.session.securityQuestionsSet = user.securityQuestionsSet ?? false;

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
