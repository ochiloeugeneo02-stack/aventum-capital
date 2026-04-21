import { Router, type IRouter } from "express";
import { db, turnSwapRequestsTable, groupMembersTable, groupsTable, usersTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";
import { getAppBaseUrl } from "../lib/appUrl";
import { sendSwapRequestNotificationToAdmin } from "../lib/email";

const router: IRouter = Router();

async function getMembership(userId: number, groupId: number) {
  const [row] = await db
    .select()
    .from(groupMembersTable)
    .where(and(eq(groupMembersTable.userId, userId), eq(groupMembersTable.groupId, groupId)))
    .limit(1);
  return row ?? null;
}

router.post("/groups/:groupId/swap-requests", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group ID" }); return; }

  const requesterId = req.session.userId!;
  const requesterMembership = await getMembership(requesterId, groupId);
  if (!requesterMembership) { res.status(403).json({ error: "You are not a member of this group" }); return; }

  const { targetMemberId, reason } = req.body;
  if (!targetMemberId) { res.status(400).json({ error: "Target member is required" }); return; }

  const targetId = parseInt(targetMemberId);
  if (isNaN(targetId) || targetId === requesterId) {
    res.status(400).json({ error: "Invalid target member" });
    return;
  }

  const targetMembership = await getMembership(targetId, groupId);
  if (!targetMembership) { res.status(400).json({ error: "Target member is not in this group" }); return; }

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const existing = await db
    .select()
    .from(turnSwapRequestsTable)
    .where(and(
      eq(turnSwapRequestsTable.groupId, groupId),
      eq(turnSwapRequestsTable.requesterId, requesterId),
      eq(turnSwapRequestsTable.status, "pending")
    ))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "You already have a pending swap request in this group" });
    return;
  }

  const [swapRequest] = await db.insert(turnSwapRequestsTable).values({
    groupId,
    requesterId,
    targetMemberId: targetId,
    reason: reason?.trim() || null,
    status: "pending",
  }).returning();

  logger.info({ requesterId, groupId, targetId }, "Turn swap request created");
  Promise.resolve().then(async () => {
    try {
      const appBaseUrl = getAppBaseUrl(req);
      const [requester, targetMember, admin] = await Promise.all([
        db.select().from(usersTable).where(eq(usersTable.id, requesterId)).limit(1).then(r => r[0]),
        db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1).then(r => r[0]),
        db.select().from(usersTable).where(eq(usersTable.id, group.adminId)).limit(1).then(r => r[0]),
      ]);
      if (!requester || !targetMember || !admin || admin.id === requester.id) return;
      await sendSwapRequestNotificationToAdmin({
        email: admin.email,
        adminName: admin.name,
        groupName: group.name,
        requesterName: requester.name,
        targetMemberName: targetMember.name,
        reason: reason?.trim() || null,
        submittedAt: swapRequest.createdAt ?? new Date(),
        appBaseUrl,
      });
    } catch (err) {
      logger.error({ err, groupId, requesterId, targetId }, "swap request admin notification failed");
    }
  });
  res.status(201).json(swapRequest);
});

router.get("/groups/:groupId/swap-requests", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group ID" }); return; }

  const userId = req.session.userId!;
  const userRole = req.session.userRole;

  if (userRole !== "super_admin") {
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
    if (!group || group.adminId !== userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
  }

  const requests = await db
    .select({
      id: turnSwapRequestsTable.id,
      groupId: turnSwapRequestsTable.groupId,
      requesterId: turnSwapRequestsTable.requesterId,
      targetMemberId: turnSwapRequestsTable.targetMemberId,
      reason: turnSwapRequestsTable.reason,
      status: turnSwapRequestsTable.status,
      adminNote: turnSwapRequestsTable.adminNote,
      createdAt: turnSwapRequestsTable.createdAt,
      requesterName: usersTable.name,
    })
    .from(turnSwapRequestsTable)
    .leftJoin(usersTable, eq(usersTable.id, turnSwapRequestsTable.requesterId))
    .where(eq(turnSwapRequestsTable.groupId, groupId))
    .orderBy(desc(turnSwapRequestsTable.createdAt));

  const targetIds = [...new Set(requests.map(r => r.targetMemberId))];
  const targetUsers = targetIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(inArray(usersTable.id, targetIds))
    : [];

  const targetMap = Object.fromEntries(targetUsers.map(u => [u.id, u.name]));

  res.json(requests.map(r => ({
    ...r,
    targetMemberName: targetMap[r.targetMemberId] ?? "Unknown",
  })));
});

router.get("/groups/:groupId/swap-requests/my", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group ID" }); return; }

  const userId = req.session.userId!;

  const requests = await db
    .select()
    .from(turnSwapRequestsTable)
    .where(and(
      eq(turnSwapRequestsTable.groupId, groupId),
      eq(turnSwapRequestsTable.requesterId, userId)
    ))
    .orderBy(desc(turnSwapRequestsTable.createdAt));

  res.json(requests);
});

router.post("/swap-requests/:id/approve", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.session.userId!;
  const userRole = req.session.userRole;

  const [swapRequest] = await db.select().from(turnSwapRequestsTable).where(eq(turnSwapRequestsTable.id, id)).limit(1);
  if (!swapRequest) { res.status(404).json({ error: "Request not found" }); return; }
  if (swapRequest.status !== "pending" && swapRequest.status !== "group_admin_approved") {
    res.status(400).json({ error: "Request cannot be approved in its current state" });
    return;
  }

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, swapRequest.groupId)).limit(1);
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const { adminNote } = req.body;

  if (userRole === "super_admin") {
    await db.update(turnSwapRequestsTable).set({
      status: "approved",
      adminNote: adminNote ?? swapRequest.adminNote,
      superAdminDecidedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(turnSwapRequestsTable.id, id));

    await executeSwap(swapRequest.groupId, swapRequest.requesterId, swapRequest.targetMemberId);
    logger.info({ id }, "Turn swap approved by super admin and executed");
    res.json({ message: "Swap approved and executed" });
    return;
  }

  if (group.adminId !== userId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  await db.update(turnSwapRequestsTable).set({
    status: "approved",
    adminNote: adminNote ?? null,
    groupAdminId: userId,
    groupAdminDecidedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(turnSwapRequestsTable.id, id));

  await executeSwap(swapRequest.groupId, swapRequest.requesterId, swapRequest.targetMemberId);
  logger.info({ id }, "Turn swap approved by group admin and executed");
  res.json({ message: "Swap approved and executed" });
});

router.post("/swap-requests/:id/deny", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.session.userId!;
  const userRole = req.session.userRole;

  const [swapRequest] = await db.select().from(turnSwapRequestsTable).where(eq(turnSwapRequestsTable.id, id)).limit(1);
  if (!swapRequest) { res.status(404).json({ error: "Request not found" }); return; }
  if (swapRequest.status !== "pending" && swapRequest.status !== "group_admin_approved") {
    res.status(400).json({ error: "Request is not pending" });
    return;
  }

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, swapRequest.groupId)).limit(1);
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  if (userRole !== "super_admin" && group.adminId !== userId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  const { adminNote } = req.body;
  await db.update(turnSwapRequestsTable).set({
    status: "denied",
    adminNote: adminNote ?? null,
    groupAdminId: userRole !== "super_admin" ? userId : swapRequest.groupAdminId,
    groupAdminDecidedAt: userRole !== "super_admin" ? new Date() : swapRequest.groupAdminDecidedAt,
    superAdminDecidedAt: userRole === "super_admin" ? new Date() : undefined,
    updatedAt: new Date(),
  }).where(eq(turnSwapRequestsTable.id, id));

  res.json({ message: "Swap request denied" });
});

router.delete("/swap-requests/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const userId = req.session.userId!;

  const [swapRequest] = await db.select().from(turnSwapRequestsTable).where(eq(turnSwapRequestsTable.id, id)).limit(1);
  if (!swapRequest) { res.status(404).json({ error: "Request not found" }); return; }
  if (swapRequest.requesterId !== userId) { res.status(403).json({ error: "Not authorized" }); return; }
  if (swapRequest.status !== "pending") { res.status(400).json({ error: "Only pending requests can be cancelled" }); return; }

  await db.update(turnSwapRequestsTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(turnSwapRequestsTable.id, id));
  res.json({ message: "Swap request cancelled" });
});

router.get("/admin/swap-requests", requireAuth, async (req, res): Promise<void> => {
  if (req.session.userRole !== "super_admin") { res.status(403).json({ error: "Not authorized" }); return; }

  const requests = await db
    .select({
      id: turnSwapRequestsTable.id,
      groupId: turnSwapRequestsTable.groupId,
      requesterId: turnSwapRequestsTable.requesterId,
      targetMemberId: turnSwapRequestsTable.targetMemberId,
      reason: turnSwapRequestsTable.reason,
      status: turnSwapRequestsTable.status,
      adminNote: turnSwapRequestsTable.adminNote,
      createdAt: turnSwapRequestsTable.createdAt,
      requesterName: usersTable.name,
      groupName: groupsTable.name,
    })
    .from(turnSwapRequestsTable)
    .leftJoin(usersTable, eq(usersTable.id, turnSwapRequestsTable.requesterId))
    .leftJoin(groupsTable, eq(groupsTable.id, turnSwapRequestsTable.groupId))
    .orderBy(desc(turnSwapRequestsTable.createdAt));

  res.json(requests);
});

async function executeSwap(groupId: number, userAId: number, userBId: number): Promise<void> {
  const [memberA] = await db
    .select()
    .from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userAId)))
    .limit(1);

  const [memberB] = await db
    .select()
    .from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userBId)))
    .limit(1);

  if (!memberA || !memberB) return;

  const orderA = memberA.rotationOrder;
  const orderB = memberB.rotationOrder;

  await db.update(groupMembersTable)
    .set({ rotationOrder: orderB })
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userAId)));

  await db.update(groupMembersTable)
    .set({ rotationOrder: orderA })
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userBId)));
}

export default router;
