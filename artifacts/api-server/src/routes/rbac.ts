import { Router, type IRouter } from "express";
import { db, usersTable, unlockRequestsTable, roleChangeRequestsTable, financeApprovalRequestsTable, departmentsTable, groupsTable, groupMembersTable, payoutsTable } from "@workspace/db";
import { eq, inArray, desc, and } from "drizzle-orm";
import { requireAuth, requirePermission, requireRole } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { createAuditLog } from "../lib/auditLog";
import { hashPassword } from "../lib/auth";
import { sendPasswordResetEmail, sendStaffWelcomeEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { getAppBaseUrl } from "../lib/appUrl";
import crypto from "node:crypto";
import zod from "zod";

// ─── Request body schemas ──────────────────────────────────────────────────────

const VALID_ROLES = ["member","group_admin","org_admin","super_admin","ceo","cto_admin","it_support","finance","marketing","relationship_manager"] as const;

const STAFF_ONLY_ROLES = ["ceo","cto_admin","it_support","finance","marketing","relationship_manager","super_admin"] as const;

const InviteStaffBody = zod.object({
  name: zod.string().min(1).max(100).trim(),
  email: zod.string().email().toLowerCase(),
  role: zod.enum(STAFF_ONLY_ROLES),
  departmentId: zod.number().int().positive().optional(),
});

const RoleRequestBody = zod.object({
  targetUserId: zod.number().int().positive(),
  requestedRole: zod.enum(VALID_ROLES),
  reason: zod.string().max(1000).optional(),
});

const FinanceApprovalBody = zod.object({
  actionType: zod.string().min(1).max(100),
  actionPayload: zod.union([zod.string(), zod.record(zod.unknown())]),
});

const DepartmentBody = zod.object({
  name: zod.string().min(1).max(100).trim(),
  role: zod.enum(VALID_ROLES),
});

const DepartmentUpdateBody = zod.object({
  name: zod.string().min(1).max(100).trim().optional(),
  role: zod.enum(VALID_ROLES).optional(),
});

const AssignUserBody = zod.object({
  userId: zod.number().int().positive(),
});

const UpdateUserRoleBody = zod.object({
  role: zod.enum(VALID_ROLES).optional(),
  isFinanceAdmin: zod.boolean().optional(),
}).refine(d => d.role !== undefined || d.isFinanceAdmin !== undefined, {
  message: "At least one of role or isFinanceAdmin must be provided",
});

const router: IRouter = Router();

// ─── Unlock Requests ─────────────────────────────────────────────────────────

router.get("/admin/unlock-requests", requirePermission("accountUnlock:manage"), asyncHandler(async (req, res) => {
  const requests = await db.select().from(unlockRequestsTable).orderBy(desc(unlockRequestsTable.createdAt));

  const userIds = [...new Set([...requests.map(r => r.userId), ...requests.map(r => r.reviewedBy).filter(Boolean) as number[]])];
  const users = userIds.length > 0 ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  res.json(requests.map(r => ({
    id: r.id,
    userId: r.userId,
    user: userMap.has(r.userId) ? { id: userMap.get(r.userId)!.id, name: userMap.get(r.userId)!.name, email: userMap.get(r.userId)!.email, role: userMap.get(r.userId)!.role } : null,
    status: r.status,
    verifiedAt: r.verifiedAt.toISOString(),
    reviewedBy: r.reviewedBy,
    reviewer: r.reviewedBy && userMap.has(r.reviewedBy) ? { name: userMap.get(r.reviewedBy)!.name } : null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  })));
}));

router.post("/admin/unlock-requests/:id/approve", requirePermission("accountUnlock:manage"), asyncHandler(async (req, res) => {
  const reqId = parseInt(req.params.id as string, 10);
  const adminId = req.session!.userId!;

  const [unlockReq] = await db.select().from(unlockRequestsTable).where(eq(unlockRequestsTable.id, reqId)).limit(1);
  if (!unlockReq) { res.status(404).json({ error: "Unlock request not found" }); return; }
  if (unlockReq.status !== "pending") { res.status(409).json({ error: "Request already reviewed" }); return; }

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, unlockReq.userId)).limit(1);
  if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }

  // Unlock account
  await db.update(usersTable).set({ lockedAt: null, failedLoginAttempts: 0, requiresPasswordReset: true }).where(eq(usersTable.id, targetUser.id));

  // Update unlock request
  await db.update(unlockRequestsTable).set({ status: "approved", reviewedBy: adminId, reviewedAt: new Date() }).where(eq(unlockRequestsTable.id, reqId));

  // Send password reset email
  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await db.update(usersTable).set({ passwordResetToken: token, passwordResetTokenExpiry: expiry }).where(eq(usersTable.id, targetUser.id));
  await sendPasswordResetEmail({ email: targetUser.email, name: targetUser.name, token, appBaseUrl: getAppBaseUrl(req) }).catch(() => {});

  await createAuditLog({ action: "user.account_unlocked", performedBy: adminId, targetType: "user", targetId: targetUser.id, details: `Unlock request #${reqId} approved` });
  logger.info({ userId: targetUser.id, reviewedBy: adminId }, "Account unlocked by admin");

  res.json({ success: true, message: `Account for ${targetUser.name} has been unlocked and a password reset email has been sent.` });
}));

router.post("/admin/unlock-requests/:id/deny", requirePermission("accountUnlock:manage"), asyncHandler(async (req, res) => {
  const reqId = parseInt(req.params.id as string, 10);
  const adminId = req.session!.userId!;

  const [unlockReq] = await db.select().from(unlockRequestsTable).where(eq(unlockRequestsTable.id, reqId)).limit(1);
  if (!unlockReq) { res.status(404).json({ error: "Unlock request not found" }); return; }
  if (unlockReq.status !== "pending") { res.status(409).json({ error: "Request already reviewed" }); return; }

  await db.update(unlockRequestsTable).set({ status: "denied", reviewedBy: adminId, reviewedAt: new Date() }).where(eq(unlockRequestsTable.id, reqId));

  await createAuditLog({ action: "user.unlock_denied", performedBy: adminId, targetType: "user", targetId: unlockReq.userId, details: `Unlock request #${reqId} denied` });

  res.json({ success: true, message: "Unlock request denied." });
}));

// ─── Role Change Requests ─────────────────────────────────────────────────────

router.post("/admin/role-requests", requirePermission("roles:request"), asyncHandler(async (req, res) => {
  const parsed = RoleRequestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error", message: parsed.error.issues[0]?.message }); return; }
  const { targetUserId, requestedRole, reason } = parsed.data;
  const requestedBy = req.session!.userId!;

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId)).limit(1);
  if (!targetUser) { res.status(404).json({ error: "Target user not found" }); return; }

  const [request] = await db.insert(roleChangeRequestsTable).values({
    requestedBy,
    targetUserId,
    requestedRole,
    reason: reason ?? null,
    status: "pending",
  }).returning();

  await createAuditLog({ action: "role.change_requested", performedBy: requestedBy, targetType: "user", targetId: targetUserId, details: `Requested role: ${requestedRole}` });

  res.status(201).json(request);
}));

router.get("/admin/role-requests", requirePermission("roleRequests:approve"), asyncHandler(async (req, res) => {
  const requests = await db.select().from(roleChangeRequestsTable).orderBy(desc(roleChangeRequestsTable.createdAt));

  const userIds = [...new Set([
    ...requests.map(r => r.requestedBy),
    ...requests.map(r => r.targetUserId),
    ...requests.map(r => r.reviewedBy).filter(Boolean) as number[],
  ])];
  const users = userIds.length > 0 ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  res.json(requests.map(r => ({
    id: r.id,
    requestedBy: r.requestedBy,
    requester: userMap.has(r.requestedBy) ? { name: userMap.get(r.requestedBy)!.name, email: userMap.get(r.requestedBy)!.email } : null,
    targetUserId: r.targetUserId,
    targetUser: userMap.has(r.targetUserId) ? { name: userMap.get(r.targetUserId)!.name, email: userMap.get(r.targetUserId)!.email, role: userMap.get(r.targetUserId)!.role } : null,
    requestedRole: r.requestedRole,
    reason: r.reason,
    status: r.status,
    reviewedBy: r.reviewedBy,
    reviewer: r.reviewedBy && userMap.has(r.reviewedBy) ? { name: userMap.get(r.reviewedBy)!.name } : null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  })));
}));

router.post("/admin/role-requests/:id/approve", requirePermission("roleRequests:approve"), asyncHandler(async (req, res) => {
  const reqId = parseInt(req.params.id as string, 10);
  const adminId = req.session!.userId!;

  const [roleReq] = await db.select().from(roleChangeRequestsTable).where(eq(roleChangeRequestsTable.id, reqId)).limit(1);
  if (!roleReq) { res.status(404).json({ error: "Role change request not found" }); return; }
  if (roleReq.status !== "pending") { res.status(409).json({ error: "Request already reviewed" }); return; }

  await db.update(usersTable).set({ role: roleReq.requestedRole }).where(eq(usersTable.id, roleReq.targetUserId));
  await db.update(roleChangeRequestsTable).set({ status: "approved", reviewedBy: adminId, reviewedAt: new Date() }).where(eq(roleChangeRequestsTable.id, reqId));

  await createAuditLog({ action: "role.change_approved", performedBy: adminId, targetType: "user", targetId: roleReq.targetUserId, details: `New role: ${roleReq.requestedRole}` });

  res.json({ success: true, message: "Role change approved and applied." });
}));

router.post("/admin/role-requests/:id/deny", requirePermission("roleRequests:approve"), asyncHandler(async (req, res) => {
  const reqId = parseInt(req.params.id as string, 10);
  const adminId = req.session!.userId!;

  const [roleReq] = await db.select().from(roleChangeRequestsTable).where(eq(roleChangeRequestsTable.id, reqId)).limit(1);
  if (!roleReq) { res.status(404).json({ error: "Role change request not found" }); return; }
  if (roleReq.status !== "pending") { res.status(409).json({ error: "Request already reviewed" }); return; }

  await db.update(roleChangeRequestsTable).set({ status: "denied", reviewedBy: adminId, reviewedAt: new Date() }).where(eq(roleChangeRequestsTable.id, reqId));

  await createAuditLog({ action: "role.change_denied", performedBy: adminId, targetType: "user", targetId: roleReq.targetUserId });

  res.json({ success: true, message: "Role change request denied." });
}));

// ─── Finance Approval Requests ────────────────────────────────────────────────

router.post("/admin/finance-approvals", requirePermission("finance:full"), asyncHandler(async (req, res) => {
  const requestedBy = req.session!.userId!;

  const parsed = FinanceApprovalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error", message: parsed.error.issues[0]?.message }); return; }
  const { actionType, actionPayload } = parsed.data;

  const [request] = await db.insert(financeApprovalRequestsTable).values({
    requestedBy,
    actionType,
    actionPayload: typeof actionPayload === "string" ? actionPayload : JSON.stringify(actionPayload),
    status: "pending",
  }).returning();

  await createAuditLog({ action: "finance.approval_requested", performedBy: requestedBy, targetType: "finance", details: `Action: ${actionType}` });

  res.status(201).json(request);
}));

router.get("/admin/finance-approvals", requirePermission("financeApprovals:approve"), asyncHandler(async (req, res) => {
  const actorId = req.session!.userId!;
  const actorRole = req.session!.userRole ?? "";
  const canSeeAll = req.session!.isFinanceAdmin || actorRole === "ceo" || actorRole === "super_admin";

  // Non-CFO finance staff see only their own submitted requests; CFO/CEO/super_admin see all
  const requests = canSeeAll
    ? await db.select().from(financeApprovalRequestsTable).orderBy(desc(financeApprovalRequestsTable.createdAt))
    : await db.select().from(financeApprovalRequestsTable).where(eq(financeApprovalRequestsTable.requestedBy, actorId)).orderBy(desc(financeApprovalRequestsTable.createdAt));

  const userIds = [...new Set([...requests.map(r => r.requestedBy), ...requests.map(r => r.reviewedBy).filter(Boolean) as number[]])];
  const users = userIds.length > 0 ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  res.json(requests.map(r => ({
    id: r.id,
    requestedBy: r.requestedBy,
    requester: userMap.has(r.requestedBy) ? { name: userMap.get(r.requestedBy)!.name, email: userMap.get(r.requestedBy)!.email } : null,
    actionType: r.actionType,
    actionPayload: (() => { try { return JSON.parse(r.actionPayload); } catch { return {}; } })(),
    status: r.status,
    reviewedBy: r.reviewedBy,
    reviewer: r.reviewedBy && userMap.has(r.reviewedBy) ? { name: userMap.get(r.reviewedBy)!.name } : null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  })));
}));

router.post("/admin/finance-approvals/:id/approve", requirePermission("financeApprovals:approve"), asyncHandler(async (req, res) => {
  const reqId = parseInt(req.params.id as string, 10);
  const adminId = req.session!.userId!;

  const [finReq] = await db.select().from(financeApprovalRequestsTable).where(eq(financeApprovalRequestsTable.id, reqId)).limit(1);
  if (!finReq) { res.status(404).json({ error: "Finance approval request not found" }); return; }
  if (finReq.status !== "pending") { res.status(409).json({ error: "Request already reviewed" }); return; }

  const [reviewer] = await db.select().from(usersTable).where(eq(usersTable.id, adminId)).limit(1);
  if (!reviewer?.isFinanceAdmin && reviewer?.role !== "ceo" && reviewer?.role !== "super_admin") {
    res.status(403).json({ error: "Only CFO/Finance Admin or CEO can approve finance requests" });
    return;
  }

  await db.update(financeApprovalRequestsTable).set({ status: "approved", reviewedBy: adminId, reviewedAt: new Date() }).where(eq(financeApprovalRequestsTable.id, reqId));
  await createAuditLog({ action: "finance.approval_approved", performedBy: adminId, targetType: "finance", details: `Action: ${finReq.actionType}` });

  // Execute the requested action upon approval
  let executionResult: Record<string, unknown> = {};

  if (finReq.actionType === "manual_payout") {
    try {
      const payload = JSON.parse(finReq.actionPayload) as { groupId: number; cycleId: number };
      const { groupId, cycleId } = payload;

      const [existingPayout] = await db.select().from(payoutsTable)
        .where(and(eq(payoutsTable.groupId, groupId), eq(payoutsTable.cycleId, cycleId)))
        .limit(1);
      if (existingPayout) {
        executionResult = { payoutId: existingPayout.id, skipped: true, reason: "Payout already exists for this group and cycle" };
      } else {
        const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
        if (group) {
          const members = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
          const rotationMember = members.find((m) => m.rotationOrder === group.currentRotationIndex);
          if (rotationMember) {
            const totalPayout = parseFloat(group.contributionAmount as unknown as string) * members.length;
            const [payout] = await db.insert(payoutsTable).values({
              groupId,
              cycleId,
              recipientId: rotationMember.userId,
              amount: String(totalPayout),
              status: "pending",
            }).returning();
            await createAuditLog({ action: "payout.trigger", performedBy: adminId, targetType: "payout", targetId: payout.id, details: `Executed via finance approval #${reqId}` });
            executionResult = { payoutId: payout.id, amount: totalPayout, groupId };
          }
        }
      }
    } catch (e) {
      logger.error({ error: e, reqId }, "Failed to execute manual_payout after finance approval");
      executionResult = { error: "Payout execution failed after approval. Please trigger manually." };
    }
  } else if (finReq.actionType === "payout_transfer") {
    // Dual-control payout transfer: finance staff queued it, CFO/CEO is now approving it
    try {
      const payload = JSON.parse(finReq.actionPayload) as { payoutId: number };
      const { payoutId } = payload;

      const [payout] = await db.select().from(payoutsTable).where(eq(payoutsTable.id, payoutId)).limit(1);
      if (!payout) {
        executionResult = { error: "Payout not found", payoutId };
      } else if (payout.status === "paid") {
        executionResult = { skipped: true, payoutId, reason: "Payout already completed" };
      } else {
        const [recipient] = await db.select().from(usersTable).where(eq(usersTable.id, payout.recipientId)).limit(1);
        const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, payout.groupId)).limit(1);
        const amount = parseFloat(payout.amount as unknown as string);
        const currency = group?.currency ?? "USD";
        const TRANSACTION_FEE_RATE = 0.025;
        const transactionFee = Number((amount * TRANSACTION_FEE_RATE).toFixed(2));
        const netAmount = Number((amount - transactionFee).toFixed(2));

        const [updated] = await db.update(payoutsTable)
          .set({ status: "paid", paidAt: new Date() })
          .where(eq(payoutsTable.id, payoutId))
          .returning();

        await createAuditLog({
          action: "payout.complete",
          performedBy: adminId,
          targetType: "payout",
          targetId: payoutId,
          details: `CFO-approved transfer of ${currency} ${netAmount.toLocaleString()} to ${recipient?.email ?? "unknown"}; fee ${currency} ${transactionFee.toLocaleString()}; via finance approval #${reqId}`,
        });

        executionResult = {
          payoutId: updated.id,
          recipientEmail: recipient?.email,
          amount,
          transactionFee,
          netAmount,
          currency,
          status: updated.status,
          paidAt: updated.paidAt?.toISOString(),
        };
      }
    } catch (e) {
      logger.error({ error: e, reqId }, "Failed to execute payout_transfer after finance approval");
      executionResult = { error: "Payout transfer execution failed after approval. Please complete manually." };
    }
  } else {
    // Unknown action type: log for operator visibility but do not silently succeed
    logger.warn({ actionType: finReq.actionType, reqId }, "Finance approval approved for unhandled actionType — no business action executed");
    executionResult = { warning: `Action type '${finReq.actionType}' approved but has no automated execution handler. Operator must complete manually.` };
  }

  res.json({ success: true, message: "Finance action approved.", actionType: finReq.actionType, executionResult });
}));

router.post("/admin/finance-approvals/:id/deny", requirePermission("financeApprovals:approve"), asyncHandler(async (req, res) => {
  const reqId = parseInt(req.params.id as string, 10);
  const adminId = req.session!.userId!;

  const [finReq] = await db.select().from(financeApprovalRequestsTable).where(eq(financeApprovalRequestsTable.id, reqId)).limit(1);
  if (!finReq) { res.status(404).json({ error: "Finance approval request not found" }); return; }
  if (finReq.status !== "pending") { res.status(409).json({ error: "Request already reviewed" }); return; }

  // Only CFO (isFinanceAdmin), CEO, or super_admin can deny finance requests — same as approve
  const [reviewer] = await db.select().from(usersTable).where(eq(usersTable.id, adminId)).limit(1);
  if (!reviewer?.isFinanceAdmin && reviewer?.role !== "ceo" && reviewer?.role !== "super_admin") {
    res.status(403).json({ error: "Only CFO/Finance Admin or CEO can deny finance requests" });
    return;
  }

  await db.update(financeApprovalRequestsTable).set({ status: "denied", reviewedBy: adminId, reviewedAt: new Date() }).where(eq(financeApprovalRequestsTable.id, reqId));
  await createAuditLog({ action: "finance.approval_denied", performedBy: adminId, targetType: "finance", details: `Action: ${finReq.actionType}` });

  res.json({ success: true, message: "Finance action denied." });
}));

// ─── Departments ─────────────────────────────────────────────────────────────

router.get("/admin/departments", requirePermission("departments:view"), asyncHandler(async (req, res) => {
  const departments = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  const staffInDept = await db.select({ departmentId: usersTable.departmentId, count: db.$count(usersTable) })
    .from(usersTable)
    .groupBy(usersTable.departmentId);
  const countMap = new Map(staffInDept.map(s => [s.departmentId, Number(s.count)]));

  res.json(departments.map(d => ({ ...d, memberCount: countMap.get(d.id) ?? 0 })));
}));

router.post("/admin/departments", requirePermission("departments:manage"), asyncHandler(async (req, res) => {
  const parsed = DepartmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error", message: parsed.error.issues[0]?.message }); return; }
  const { name, role } = parsed.data;

  const [dept] = await db.insert(departmentsTable).values({ name, role }).returning();
  await createAuditLog({ action: "department.created", performedBy: req.session!.userId!, targetType: "department", targetId: dept.id, details: name });

  res.status(201).json(dept);
}));

router.put("/admin/departments/:id", requirePermission("departments:manage"), asyncHandler(async (req, res) => {
  const deptId = parseInt(req.params.id as string, 10);
  const parsed = DepartmentUpdateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error", message: parsed.error.issues[0]?.message }); return; }
  const { name, role } = parsed.data;

  const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, deptId)).limit(1);
  if (!dept) { res.status(404).json({ error: "Department not found" }); return; }

  const newRole = role ?? dept.role;
  const [updated] = await db.update(departmentsTable).set({ name: name ?? dept.name, role: newRole }).where(eq(departmentsTable.id, deptId)).returning();

  // Propagate role change to all users assigned to this department
  // so department assignment remains authoritative as source-of-truth
  if (role !== undefined && role !== dept.role) {
    await db.update(usersTable).set({ role: newRole }).where(eq(usersTable.departmentId, deptId));
    await createAuditLog({
      action: "department.role_propagated",
      performedBy: req.session!.userId!,
      targetType: "department",
      targetId: deptId,
      details: `Role changed from ${dept.role} to ${newRole} — propagated to all department members`,
    });
  }

  res.json(updated);
}));

router.delete("/admin/departments/:id", requirePermission("departments:manage"), asyncHandler(async (req, res) => {
  const deptId = parseInt(req.params.id as string, 10);

  await db.update(usersTable).set({ departmentId: null }).where(eq(usersTable.departmentId, deptId));
  await db.delete(departmentsTable).where(eq(departmentsTable.id, deptId));

  await createAuditLog({ action: "department.deleted", performedBy: req.session!.userId!, targetType: "department", targetId: deptId });
  res.json({ success: true });
}));

router.post("/admin/departments/:id/assign", requirePermission("departments:manage"), asyncHandler(async (req, res) => {
  const deptId = parseInt(req.params.id as string, 10);
  const parsed = AssignUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error", message: parsed.error.issues[0]?.message }); return; }
  const { userId } = parsed.data;

  const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, deptId)).limit(1);
  if (!dept) { res.status(404).json({ error: "Department not found" }); return; }

  // Role-as-source-of-truth: assigning a user to a department updates their role
  // to match the department's designated role. Authorization checks use
  // req.session.userRole which is refreshed on login/re-auth.
  await db.update(usersTable).set({ departmentId: deptId, role: dept.role }).where(eq(usersTable.id, userId));
  await createAuditLog({ action: "department.user_assigned", performedBy: req.session!.userId!, targetType: "user", targetId: userId, details: `Department: ${dept.name}, role updated to: ${dept.role}` });

  res.json({ success: true });
}));

router.get("/admin/departments/:id/staff", requirePermission("departments:view"), asyncHandler(async (req, res) => {
  const deptId = parseInt(req.params.id as string, 10);
  const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, deptId)).limit(1);
  if (!dept) { res.status(404).json({ error: "Department not found" }); return; }

  const staff = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    isFinanceAdmin: usersTable.isFinanceAdmin,
  }).from(usersTable).where(eq(usersTable.departmentId, deptId));

  res.json(staff);
}));

// ─── Staff user management (set role/isFinanceAdmin) ─────────────────────────

router.put("/admin/users/:id/role", requirePermission("roles:assign"), asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id as string, 10);
  const parsed = UpdateUserRoleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error", message: parsed.error.issues[0]?.message }); return; }
  const { role, isFinanceAdmin } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [updated] = await db.update(usersTable)
    .set({
      ...(role !== undefined ? { role } : {}),
      ...(isFinanceAdmin !== undefined ? { isFinanceAdmin } : {}),
    })
    .where(eq(usersTable.id, userId))
    .returning();

  await createAuditLog({ action: "user.role_updated", performedBy: req.session!.userId!, targetType: "user", targetId: userId, details: JSON.stringify({ role, isFinanceAdmin }) });

  res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role, isFinanceAdmin: updated.isFinanceAdmin });
}));

// ─── Staff user invitation ────────────────────────────────────────────────────

router.post("/admin/staff-users", requirePermission("roles:assign"), asyncHandler(async (req, res) => {
  const parsed = InviteStaffBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error", message: parsed.error.issues[0]?.message }); return; }
  const { name, email, role, departmentId } = parsed.data;
  const adminId = req.session!.userId!;

  // Check email not already taken
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) { res.status(409).json({ error: "A user with this email address already exists" }); return; }

  // Validate department if provided
  if (departmentId !== undefined) {
    const [dept] = await db.select({ id: departmentsTable.id }).from(departmentsTable).where(eq(departmentsTable.id, departmentId)).limit(1);
    if (!dept) { res.status(404).json({ error: "Department not found" }); return; }
  }

  // Generate a random temporary password (user must reset it before use)
  const tempPassword = crypto.randomBytes(24).toString("hex");
  const hashedTemp = await hashPassword(tempPassword);

  const [newUser] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash: hashedTemp,
    role,
    departmentId: departmentId ?? null,
    requiresPasswordReset: true,
    isActive: true,
  }).returning();

  // Generate password-reset token (24 h) so the invite link sets the real password
  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.update(usersTable).set({ passwordResetToken: token, passwordResetTokenExpiry: expiry }).where(eq(usersTable.id, newUser.id));

  // Send welcome/set-password email (fire and forget — log failures for observability)
  sendStaffWelcomeEmail({ email: newUser.email, name: newUser.name, role: newUser.role, token, appBaseUrl: getAppBaseUrl(req) }).catch((err) => {
    logger.error({ err, email: newUser.email, newUserId: newUser.id }, "Staff invitation email failed to send");
  });

  await createAuditLog({
    action: "user.staff_invited",
    performedBy: adminId,
    targetType: "user",
    targetId: newUser.id,
    details: `Staff account created: role=${role}, email=${email}${departmentId ? `, departmentId=${departmentId}` : ""}`,
  });

  logger.info({ newUserId: newUser.id, role, email, adminId }, "Staff user invited");

  res.status(201).json({
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    departmentId: newUser.departmentId,
    requiresPasswordReset: true,
    createdAt: newUser.createdAt.toISOString(),
  });
}));

export default router;
