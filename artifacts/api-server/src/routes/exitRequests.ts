import { Router, type IRouter } from "express";
import { db, exitRequestsTable, groupMembersTable, groupsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createAuditLog } from "../lib/auditLog";

const router: IRouter = Router();

// Member submits an exit request
router.post("/groups/:groupId/exit-request", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId, 10);
  const userId = req.session!.userId!;
  const { reason, termsAccepted } = req.body as { reason?: string; termsAccepted: boolean };

  if (!termsAccepted) {
    res.status(400).json({ error: "You must accept the terms of service to submit an exit request" });
    return;
  }

  const [membership] = await db.select()
    .from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId)))
    .limit(1);

  if (!membership) {
    res.status(403).json({ error: "You are not a member of this group" });
    return;
  }

  const [existing] = await db.select()
    .from(exitRequestsTable)
    .where(and(
      eq(exitRequestsTable.groupId, groupId),
      eq(exitRequestsTable.userId, userId),
      eq(exitRequestsTable.status, "pending")
    ))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "You already have a pending exit request for this group" });
    return;
  }

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const autoApproveAfterCycle = membership.hasReceivedPayout ? group.currentCycle : null;

  const [request] = await db.insert(exitRequestsTable).values({
    groupId,
    userId,
    status: "pending",
    reason: reason ?? null,
    termsAccepted: true,
    termsAcceptedAt: new Date(),
    autoApproveAfterCycle,
  }).returning();

  await createAuditLog({
    action: "group.exit_request",
    performedBy: userId,
    targetType: "group",
    targetId: groupId,
    details: reason ?? "No reason provided",
  });

  res.status(201).json({
    id: request.id,
    status: request.status,
    autoApproveAfterCycle: request.autoApproveAfterCycle,
    message: membership.hasReceivedPayout
      ? "Your exit request has been submitted. It will be reviewed by Aventum Capital support."
      : "Your exit request has been submitted and is under review by Aventum Capital.",
  });
});

// Member views their own exit requests
router.get("/exit-requests/mine", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;

  const requests = await db.select({
    id: exitRequestsTable.id,
    groupId: exitRequestsTable.groupId,
    groupName: groupsTable.name,
    status: exitRequestsTable.status,
    reason: exitRequestsTable.reason,
    reviewNote: exitRequestsTable.reviewNote,
    autoApproveAfterCycle: exitRequestsTable.autoApproveAfterCycle,
    createdAt: exitRequestsTable.createdAt,
    reviewedAt: exitRequestsTable.reviewedAt,
  })
    .from(exitRequestsTable)
    .leftJoin(groupsTable, eq(groupsTable.id, exitRequestsTable.groupId))
    .where(eq(exitRequestsTable.userId, userId))
    .orderBy(sql`${exitRequestsTable.createdAt} DESC`);

  res.json(requests);
});

// Member cancels their own pending exit request
router.post("/groups/:groupId/exit-request/cancel", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId, 10);
  const userId = req.session!.userId!;

  const [request] = await db.select()
    .from(exitRequestsTable)
    .where(and(
      eq(exitRequestsTable.groupId, groupId),
      eq(exitRequestsTable.userId, userId),
      eq(exitRequestsTable.status, "pending")
    ))
    .limit(1);

  if (!request) {
    res.status(404).json({ error: "No pending exit request found for this group" });
    return;
  }

  await db.update(exitRequestsTable)
    .set({ status: "cancelled" })
    .where(eq(exitRequestsTable.id, request.id));

  await createAuditLog({
    action: "group.exit_cancelled",
    performedBy: userId,
    targetType: "group",
    targetId: groupId,
    details: "Member cancelled their exit request",
  });

  res.json({ success: true, message: "Your exit request has been cancelled." });
});

// Super admin — view ALL exit requests across the platform
router.get("/exit-requests/all", requireAuth, async (req, res): Promise<void> => {
  const userRole = (req.session as any).userRole ?? (req.session as any).role;
  if (userRole !== "super_admin") {
    res.status(403).json({ error: "Only super admins can view all exit requests" });
    return;
  }

  const requests = await db.select({
    id: exitRequestsTable.id,
    groupId: exitRequestsTable.groupId,
    groupName: groupsTable.name,
    userId: exitRequestsTable.userId,
    userName: usersTable.name,
    userEmail: usersTable.email,
    status: exitRequestsTable.status,
    reason: exitRequestsTable.reason,
    reviewNote: exitRequestsTable.reviewNote,
    termsAccepted: exitRequestsTable.termsAccepted,
    termsAcceptedAt: exitRequestsTable.termsAcceptedAt,
    autoApproveAfterCycle: exitRequestsTable.autoApproveAfterCycle,
    createdAt: exitRequestsTable.createdAt,
    reviewedAt: exitRequestsTable.reviewedAt,
  })
    .from(exitRequestsTable)
    .leftJoin(groupsTable, eq(groupsTable.id, exitRequestsTable.groupId))
    .leftJoin(usersTable, eq(usersTable.id, exitRequestsTable.userId))
    .orderBy(sql`${exitRequestsTable.createdAt} DESC`);

  res.json(requests);
});

// Group admin — view exit requests for their specific group (read-only)
router.get("/groups/:groupId/exit-requests", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId, 10);
  const userId = req.session!.userId!;
  const userRole = (req.session as any).userRole ?? (req.session as any).role;

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  if (group.adminId !== userId && userRole !== "super_admin") {
    res.status(403).json({ error: "Only the group admin can view exit requests" });
    return;
  }

  const requests = await db.select({
    id: exitRequestsTable.id,
    groupId: exitRequestsTable.groupId,
    userId: exitRequestsTable.userId,
    userName: usersTable.name,
    userEmail: usersTable.email,
    status: exitRequestsTable.status,
    reason: exitRequestsTable.reason,
    reviewNote: exitRequestsTable.reviewNote,
    autoApproveAfterCycle: exitRequestsTable.autoApproveAfterCycle,
    createdAt: exitRequestsTable.createdAt,
    reviewedAt: exitRequestsTable.reviewedAt,
  })
    .from(exitRequestsTable)
    .leftJoin(usersTable, eq(usersTable.id, exitRequestsTable.userId))
    .where(eq(exitRequestsTable.groupId, groupId))
    .orderBy(sql`${exitRequestsTable.createdAt} DESC`);

  res.json(requests);
});

// Super admin approves an exit request
router.post("/exit-requests/:id/approve", requireAuth, async (req, res): Promise<void> => {
  const requestId = parseInt(req.params.id, 10);
  const adminId = req.session!.userId!;
  const userRole = (req.session as any).userRole ?? (req.session as any).role;
  const { note } = req.body as { note?: string };

  if (userRole !== "super_admin") {
    res.status(403).json({ error: "Only Aventum Capital super admins can approve exit requests" });
    return;
  }

  const [request] = await db.select()
    .from(exitRequestsTable)
    .where(eq(exitRequestsTable.id, requestId))
    .limit(1);

  if (!request) {
    res.status(404).json({ error: "Exit request not found" });
    return;
  }

  if (request.status !== "pending") {
    res.status(409).json({ error: `Request is already ${request.status}` });
    return;
  }

  await db.update(exitRequestsTable)
    .set({ status: "approved", reviewedBy: adminId, reviewedAt: new Date(), reviewNote: note ?? null })
    .where(eq(exitRequestsTable.id, requestId));

  await db.delete(groupMembersTable)
    .where(and(
      eq(groupMembersTable.groupId, request.groupId),
      eq(groupMembersTable.userId, request.userId)
    ));

  await createAuditLog({
    action: "group.exit_approved",
    performedBy: adminId,
    targetType: "group",
    targetId: request.groupId,
    details: `User ${request.userId} exit approved by super admin`,
  });

  res.json({ success: true, message: "Exit request approved. Member has been removed from the group." });
});

// Super admin denies an exit request
router.post("/exit-requests/:id/deny", requireAuth, async (req, res): Promise<void> => {
  const requestId = parseInt(req.params.id, 10);
  const adminId = req.session!.userId!;
  const userRole = (req.session as any).userRole ?? (req.session as any).role;
  const { note } = req.body as { note?: string };

  if (userRole !== "super_admin") {
    res.status(403).json({ error: "Only Aventum Capital super admins can deny exit requests" });
    return;
  }

  const [request] = await db.select()
    .from(exitRequestsTable)
    .where(eq(exitRequestsTable.id, requestId))
    .limit(1);

  if (!request) {
    res.status(404).json({ error: "Exit request not found" });
    return;
  }

  if (request.status !== "pending") {
    res.status(409).json({ error: `Request is already ${request.status}` });
    return;
  }

  await db.update(exitRequestsTable)
    .set({ status: "denied", reviewedBy: adminId, reviewedAt: new Date(), reviewNote: note ?? null })
    .where(eq(exitRequestsTable.id, requestId));

  await createAuditLog({
    action: "group.exit_denied",
    performedBy: adminId,
    targetType: "group",
    targetId: request.groupId,
    details: `User ${request.userId} exit denied by super admin. Note: ${note ?? "none"}`,
  });

  res.json({ success: true, message: "Exit request denied." });
});

// Internal: auto-approve eligible exit requests after cycle completion
export async function processAutoApprovals(groupId: number, completedCycle: number): Promise<void> {
  const pending = await db.select()
    .from(exitRequestsTable)
    .where(and(
      eq(exitRequestsTable.groupId, groupId),
      eq(exitRequestsTable.status, "pending"),
      sql`${exitRequestsTable.autoApproveAfterCycle} <= ${completedCycle}`
    ));

  for (const request of pending) {
    await db.update(exitRequestsTable)
      .set({ status: "auto_approved", reviewedAt: new Date(), reviewNote: "Auto-approved after cycle completion" })
      .where(eq(exitRequestsTable.id, request.id));

    await db.delete(groupMembersTable)
      .where(and(
        eq(groupMembersTable.groupId, request.groupId),
        eq(groupMembersTable.userId, request.userId)
      ));

    await createAuditLog({
      action: "group.exit_auto_approved",
      performedBy: 0,
      targetType: "group",
      targetId: groupId,
      details: `User ${request.userId} auto-exit after cycle ${completedCycle}`,
    });
  }
}

export default router;
