import { Router, type IRouter } from "express";
import { db, groupsTable, groupMembersTable, usersTable, contributionCyclesTable, contributionsTable, groupDeleteRequestsTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireStaffGate, isStaffRole, hasPermission } from "../lib/auth";
import { CreateGroupBody, UpdateGroupBody, InviteMemberBody } from "@workspace/api-zod";
import { createAuditLog } from "../lib/auditLog";
import { formatUser } from "./users";
import { createGroupInvitation } from "./invitations";
import { sendGroupAddedEmail, sendMemberJoinedNotificationEmail, sendAdminAddedMemberEmail, sendMemberRemovedEmail, sendCycleApprovalRequestEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { getAppBaseUrl } from "../lib/appUrl";

const router: IRouter = Router();
const DEFAULT_CURRENCY = "USD";

async function getGroupWithCounts(g: typeof groupsTable.$inferSelect) {
  const [memberCount, currentCycle] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(groupMembersTable).where(eq(groupMembersTable.groupId, g.id)),
    db.select().from(contributionCyclesTable)
      .where(and(eq(contributionCyclesTable.groupId, g.id), eq(contributionCyclesTable.cycleNumber, g.currentCycle)))
      .limit(1),
  ]);

  let paidCount = 0;
  if (currentCycle.length > 0) {
    const paid = await db.select({ count: sql<number>`count(*)` })
      .from(contributionsTable)
      .where(and(
        eq(contributionsTable.groupId, g.id),
        eq(contributionsTable.cycleId, currentCycle[0].id),
        eq(contributionsTable.status, "paid")
      ));
    paidCount = Number(paid[0]?.count ?? 0);
  }

  return {
    id: g.id,
    name: g.name,
    adminId: g.adminId,
    organizationId: g.organizationId ?? null,
    currency: g.currency ?? DEFAULT_CURRENCY,
    contributionAmount: parseFloat(g.contributionAmount as unknown as string),
    schedule: g.schedule,
    maxMembers: g.maxMembers,
    currentCycle: g.currentCycle,
    currentRotationIndex: g.currentRotationIndex,
    status: g.status,
    totalMembers: Number(memberCount[0]?.count ?? 0),
    paidCount,
    createdAt: g.createdAt.toISOString(),
  };
}

/** Returns true if the session user is the group's admin or has groups:full staff permission. */
function isGroupAdmin(
  sessionUserId: number | undefined,
  sessionRole: string | undefined,
  group: typeof groupsTable.$inferSelect,
): boolean {
  return hasPermission(sessionRole ?? "", "groups:full") || sessionUserId === group.adminId;
}

router.get("/groups", requireAuth, requireStaffGate, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const role = req.session!.userRole;

  let groups: (typeof groupsTable.$inferSelect)[];

  if (hasPermission(role ?? "", "groups:view")) {
    groups = await db.select().from(groupsTable).orderBy(groupsTable.createdAt);
  } else {
    const [memberships, adminGroups] = await Promise.all([
      db.select().from(groupMembersTable).where(eq(groupMembersTable.userId, userId)),
      db.select().from(groupsTable).where(eq(groupsTable.adminId, userId)),
    ]);

    const memberGroupIds = new Set(memberships.map((m) => m.groupId));
    const uniqueIds = [...new Set([...memberGroupIds, ...adminGroups.map((g) => g.id)])];

    if (uniqueIds.length === 0) {
      res.json([]);
      return;
    }

    groups = await db.select().from(groupsTable).where(inArray(groupsTable.id, uniqueIds));
  }

  const result = await Promise.all(groups.map(getGroupWithCounts));
  res.json(result);
});

router.post("/groups", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, contributionAmount, schedule, maxMembers, organizationId, currency } = parsed.data;
  const sessionUserId = req.session!.userId!;
  const sessionRole = req.session!.userRole;

  // Staff with groups:full permission may specify a different group admin via body.adminId
  const adminId = (hasPermission(sessionRole ?? "", "groups:full") && req.body.adminId)
    ? parseInt(String(req.body.adminId), 10)
    : sessionUserId;

  const [group] = await db.insert(groupsTable).values({
    name,
    adminId,
    organizationId: organizationId ?? null,
    currency: (currency ?? DEFAULT_CURRENCY).toUpperCase(),
    contributionAmount: String(contributionAmount),
    schedule: schedule ?? "bi-weekly",
    maxMembers: maxMembers ?? 5,
  }).returning();

  await db.insert(groupMembersTable).values({
    userId: adminId,
    groupId: group.id,
    rotationOrder: 0,
    hasReceivedPayout: false,
  });

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  await db.insert(contributionCyclesTable).values({
    groupId: group.id,
    cycleNumber: 1,
    status: "active",
    dueDate,
  });

  await createAuditLog({ action: "group.create", performedBy: sessionUserId, targetType: "group", targetId: group.id });

  res.status(201).json(await getGroupWithCounts(group));
});

router.get("/groups/:groupId", requireAuth, requireStaffGate, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId as string, 10);
  const userId = req.session!.userId!;
  const role = req.session!.userRole;

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  // Staff with groups:view can see any group; otherwise must be admin or member
  if (!hasPermission(role ?? "", "groups:view") && group.adminId !== userId) {
    const [membership] = await db.select().from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId)))
      .limit(1);
    if (!membership) {
      res.status(403).json({ error: "You are not a member of this group" });
      return;
    }
  }

  const [members, currentCycle] = await Promise.all([
    db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId)).orderBy(groupMembersTable.rotationOrder),
    db.select().from(contributionCyclesTable)
      .where(and(eq(contributionCyclesTable.groupId, groupId), eq(contributionCyclesTable.cycleNumber, group.currentCycle)))
      .limit(1),
  ]);

  const userIds = members.map((m) => m.userId);
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];

  const userMap = new Map(users.map((u) => [u.id, u]));

  let paidUserIds = new Set<number>();
  if (currentCycle.length > 0) {
    const paidContribs = await db.select().from(contributionsTable)
      .where(and(eq(contributionsTable.cycleId, currentCycle[0].id), eq(contributionsTable.status, "paid")));
    paidUserIds = new Set(paidContribs.map((c) => c.userId));
  }

  const formattedMembers = members.map((m) => {
    const u = userMap.get(m.userId);
    return {
      id: m.id,
      userId: m.userId,
      groupId: m.groupId,
      rotationOrder: m.rotationOrder,
      hasReceivedPayout: m.hasReceivedPayout,
      user: u ? formatUser(u) : null,
      contributionStatus: currentCycle.length === 0 ? "none" : paidUserIds.has(m.userId) ? "paid" : "pending",
      joinedAt: m.joinedAt.toISOString(),
    };
  });

  const rotationMember = members.find((m) => m.rotationOrder === group.currentRotationIndex);
  const currentRecipient = rotationMember ? userMap.get(rotationMember.userId) : undefined;

  const base = await getGroupWithCounts(group);

  res.json({
    ...base,
    members: formattedMembers,
    currentRecipient: currentRecipient ? formatUser(currentRecipient) : null,
    nextDueDate: currentCycle.length > 0 && currentCycle[0].dueDate ? currentCycle[0].dueDate.toISOString() : null,
    currentCycleId: currentCycle.length > 0 ? currentCycle[0].id : null,
  });
});

router.put("/groups/:groupId", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId as string, 10);

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  if (!isGroupAdmin(req.session?.userId, req.session?.userRole, group)) {
    res.status(403).json({ error: "Only the group admin can update group settings" });
    return;
  }

  const parsed = UpdateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.contributionAmount !== undefined) updateData.contributionAmount = String(parsed.data.contributionAmount);
  if (parsed.data.schedule !== undefined) updateData.schedule = parsed.data.schedule;

  const [updated] = await db.update(groupsTable).set(updateData).where(eq(groupsTable.id, groupId)).returning();

  res.json(await getGroupWithCounts(updated));
});

router.get("/groups/:groupId/members", requireAuth, requireStaffGate, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId as string, 10);
  const userId = req.session!.userId!;
  const role = req.session!.userRole;

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  // Staff with groups:view can see any group's member list; otherwise must be admin or member
  if (!hasPermission(role ?? "", "groups:view") && group.adminId !== userId) {
    const [membership] = await db.select().from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId)))
      .limit(1);
    if (!membership) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const members = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId)).orderBy(groupMembersTable.rotationOrder);
  const userIds = members.map((m) => m.userId);
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];

  const userMap = new Map(users.map((u) => [u.id, u]));

  const currentCycle = await db.select().from(contributionCyclesTable)
    .where(and(eq(contributionCyclesTable.groupId, groupId), eq(contributionCyclesTable.cycleNumber, group.currentCycle)))
    .limit(1);

  let paidUserIds = new Set<number>();
  if (currentCycle.length > 0) {
    const paidContribs = await db.select().from(contributionsTable)
      .where(and(eq(contributionsTable.cycleId, currentCycle[0].id), eq(contributionsTable.status, "paid")));
    paidUserIds = new Set(paidContribs.map((c) => c.userId));
  }

  const result = members.map((m) => {
    const u = userMap.get(m.userId);
    return {
      id: m.id,
      userId: m.userId,
      groupId: m.groupId,
      rotationOrder: m.rotationOrder,
      hasReceivedPayout: m.hasReceivedPayout,
      user: u ? formatUser(u) : null,
      contributionStatus: currentCycle.length === 0 ? "none" : paidUserIds.has(m.userId) ? "paid" : "pending",
      joinedAt: m.joinedAt.toISOString(),
    };
  });

  res.json(result);
});

router.post("/groups/:groupId/invite", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId as string, 10);

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  if (!isGroupAdmin(req.session?.userId, req.session?.userRole, group)) {
    res.status(403).json({ error: "Only the group admin can invite members" });
    return;
  }

  const parsed = InviteMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Check member cap
  const [memberCountResult] = await db.select({ count: sql<number>`count(*)` })
    .from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const currentCount = Number(memberCountResult?.count ?? 0);
  if (currentCount >= group.maxMembers) {
    res.status(400).json({ error: `Group is full (max ${group.maxMembers} members)` });
    return;
  }

  const invitedByUserId = req.session!.userId!;
  const [inviter] = await db.select().from(usersTable).where(eq(usersTable.id, invitedByUserId)).limit(1);

  // If the user already has an account, add them directly (existing behaviour)
  const [existingUser] = await db.select().from(usersTable)
    .where(eq(usersTable.email, parsed.data.email)).limit(1);

  if (existingUser) {
    const [alreadyMember] = await db.select().from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, existingUser.id)))
      .limit(1);
    if (alreadyMember) {
      res.status(409).json({ error: "User is already a member" });
      return;
    }

    const order = parsed.data.rotationOrder ?? currentCount;
    await db.insert(groupMembersTable).values({
      userId: existingUser.id,
      groupId,
      rotationOrder: order,
      hasReceivedPayout: false,
    });

    await createAuditLog({
      action: "group.invite_member",
      performedBy: invitedByUserId,
      targetType: "group",
      targetId: groupId,
      details: existingUser.email,
    });

    const appBaseUrl = getAppBaseUrl(req);

    const newTotalMembers = currentCount + 1;

    // 1. Notify the newly added member
    sendGroupAddedEmail({
      email: existingUser.email,
      name: existingUser.name,
      groupName: group.name,
      inviterName: inviter?.name ?? "A group admin",
      contributionAmount: `${group.currency} ${Number(group.contributionAmount).toLocaleString()}`,
      schedule: group.schedule,
      appBaseUrl,
    }).catch(() => {});

    // 2. Notify all other existing members + send admin confirmation (fire-and-forget)
    Promise.resolve().then(async () => {
      try {
        const existingMemberRecords = await db.select().from(groupMembersTable)
          .where(and(eq(groupMembersTable.groupId, groupId), sql`${groupMembersTable.userId} != ${existingUser.id}`));
        const otherUserIds = existingMemberRecords.map((m) => m.userId).filter((id) => id !== invitedByUserId);
        const [otherUsers, inviterUser] = await Promise.all([
          otherUserIds.length > 0 ? db.select().from(usersTable).where(inArray(usersTable.id, otherUserIds)) : Promise.resolve([]),
          inviter ? Promise.resolve(inviter) : db.select().from(usersTable).where(eq(usersTable.id, invitedByUserId)).limit(1).then((r) => r[0]),
        ]);
        otherUsers.forEach((member) => {
          sendMemberJoinedNotificationEmail({
            email: member.email,
            recipientName: member.name,
            newMemberName: existingUser.name,
            groupName: group.name,
            totalMembers: newTotalMembers,
            maxMembers: group.maxMembers,
            appBaseUrl,
          }).catch(() => {});
        });
        if (inviterUser && inviterUser.id !== existingUser.id) {
          sendAdminAddedMemberEmail({
            email: inviterUser.email,
            adminName: inviterUser.name,
            newMemberName: existingUser.name,
            newMemberEmail: existingUser.email,
            groupName: group.name,
            totalMembers: newTotalMembers,
            maxMembers: group.maxMembers,
            appBaseUrl,
          }).catch(() => {});
        }
      } catch (err) { logger.error({ err }, "member-add notification email failed"); }
    });

    res.json({ success: true, type: "direct", message: `${existingUser.name} has been added to the group` });
    return;
  }

  // No account yet — create a pending invitation with a shareable link
  const { inviteUrl, emailSent } = await createGroupInvitation({
    req,
    groupId,
    email: parsed.data.email,
    invitedBy: invitedByUserId,
    group,
    inviterName: inviter?.name ?? "A group admin",
    totalMembers: currentCount,
  });

  await createAuditLog({
    action: "group.invite_sent",
    performedBy: invitedByUserId,
    targetType: "group",
    targetId: groupId,
    details: parsed.data.email,
  });

  res.json({
    success: true,
    type: "invitation",
    message: emailSent
      ? `Invitation email sent to ${parsed.data.email}`
      : `Invite link created for ${parsed.data.email}`,
    inviteUrl,
    emailSent,
  });
});

router.delete("/groups/:groupId/members/:userId", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId as string, 10);
  const targetUserId = parseInt(req.params.userId as string, 10);

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  // Only group admin, super admin, or the member themselves can remove
  const sessionUserId = req.session!.userId!;
  if (!isGroupAdmin(req.session?.userId, req.session?.userRole, group) && sessionUserId !== targetUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Cannot remove the group admin
  if (targetUserId === group.adminId) {
    res.status(400).json({ error: "Cannot remove the group admin" });
    return;
  }

  const deleted = await db.delete(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetUserId)))
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ error: "Member not found in this group" });
    return;
  }

  await createAuditLog({
    action: "group.remove_member",
    performedBy: sessionUserId,
    targetType: "group",
    targetId: groupId,
    details: `Removed user ${targetUserId}`,
  });

  // Notify the removed member — fire and forget
  Promise.resolve().then(async () => {
    try {
      const [removedUser] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId)).limit(1);
      if (removedUser) {
        await sendMemberRemovedEmail({
          email: removedUser.email,
          memberName: removedUser.name,
          groupName: group.name,
          appBaseUrl: getAppBaseUrl(req),
        });
      }
    } catch { /* fire-and-forget */ }
  });

  res.json({ success: true });
});

router.post("/groups/:groupId/approve-next-cycle", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId as string, 10);

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const sessionUserId = req.session!.userId!;
  const isAdmin = group.adminId === sessionUserId || hasPermission(req.session?.userRole ?? "", "groups:full");
  if (!isAdmin) { res.status(403).json({ error: "Only the group admin can approve the next cycle" }); return; }

  if (group.status !== "awaiting_cycle_approval") {
    res.status(400).json({ error: `Group is ${group.status} — not awaiting cycle approval` });
    return;
  }

  const dueDate = new Date();
  if (group.schedule === "weekly") dueDate.setDate(dueDate.getDate() + 7);
  else if (group.schedule === "monthly") dueDate.setMonth(dueDate.getMonth() + 1);
  else dueDate.setDate(dueDate.getDate() + 14);

  await db.insert(contributionCyclesTable).values({
    groupId,
    cycleNumber: group.currentCycle,
    status: "active",
    dueDate,
  });

  const [updated] = await db.update(groupsTable)
    .set({ status: "active" })
    .where(eq(groupsTable.id, groupId))
    .returning();

  await createAuditLog({
    action: "group.approve_next_cycle",
    performedBy: sessionUserId,
    targetType: "group",
    targetId: groupId,
    details: `Approved start of cycle ${group.currentCycle}`,
  });

  res.json(await getGroupWithCounts(updated));
});

router.post("/groups/:groupId/deny-next-cycle", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId as string, 10);

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const sessionUserId = req.session!.userId!;
  const isAdmin = group.adminId === sessionUserId || hasPermission(req.session?.userRole ?? "", "groups:full");
  if (!isAdmin) { res.status(403).json({ error: "Only the group admin can manage cycle approval" }); return; }

  if (group.status !== "awaiting_cycle_approval") {
    res.status(400).json({ error: `Group is ${group.status} — not awaiting cycle approval` });
    return;
  }

  const [updated] = await db.update(groupsTable)
    .set({ status: "paused" })
    .where(eq(groupsTable.id, groupId))
    .returning();

  await createAuditLog({
    action: "group.deny_next_cycle",
    performedBy: sessionUserId,
    targetType: "group",
    targetId: groupId,
    details: `Denied start of cycle ${group.currentCycle} — group set to paused`,
  });

  res.json(await getGroupWithCounts(updated));
});

router.post("/groups/:groupId/pause", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId as string, 10);

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  if (!isGroupAdmin(req.session?.userId, req.session?.userRole, group)) {
    res.status(403).json({ error: "Only the group admin can pause the group" });
    return;
  }

  const [updated] = await db.update(groupsTable).set({ status: "paused" }).where(eq(groupsTable.id, groupId)).returning();
  await createAuditLog({ action: "group.pause", performedBy: req.session!.userId!, targetType: "group", targetId: groupId });
  res.json(await getGroupWithCounts(updated));
});

router.post("/groups/:groupId/resume", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId as string, 10);

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  if (!isGroupAdmin(req.session?.userId, req.session?.userRole, group)) {
    res.status(403).json({ error: "Only the group admin can resume the group" });
    return;
  }

  const [updated] = await db.update(groupsTable).set({ status: "active" }).where(eq(groupsTable.id, groupId)).returning();
  await createAuditLog({ action: "group.resume", performedBy: req.session!.userId!, targetType: "group", targetId: groupId });
  res.json(await getGroupWithCounts(updated));
});

// ── Group Delete Requests ─────────────────────────────────────────────────────

router.post("/groups/:groupId/delete-request", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId as string, 10);
  const userId = req.session!.userId!;
  const { reason } = req.body as { reason?: string };

  if (!reason?.trim()) {
    res.status(400).json({ error: "A reason is required to request group deletion" });
    return;
  }

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  if (!isGroupAdmin(userId, req.session?.userRole, group)) {
    res.status(403).json({ error: "Only the group admin can request group deletion" });
    return;
  }

  if (group.status === "deleted") {
    res.status(409).json({ error: "Group is already deleted" });
    return;
  }

  // Check for existing pending request
  const [existing] = await db.select().from(groupDeleteRequestsTable)
    .where(and(eq(groupDeleteRequestsTable.groupId, groupId), eq(groupDeleteRequestsTable.status, "pending")))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "A delete request is already pending for this group" });
    return;
  }

  const [req_] = await db.insert(groupDeleteRequestsTable).values({
    groupId,
    requestedBy: userId,
    reason: reason.trim(),
    status: "pending",
  }).returning();

  await createAuditLog({
    action: "group.delete_requested",
    performedBy: userId,
    targetType: "group",
    targetId: groupId,
    details: reason.trim(),
  });

  logger.info({ groupId, userId, reason: reason.trim() }, "Group delete request submitted");
  res.status(201).json({ success: true, requestId: req_.id, message: "Delete request submitted. Aventum Capital will review it shortly." });
});

// Static route must come before /:groupId/delete-request to avoid param capture
router.get("/groups/delete-requests/mine", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const rows = await db
    .select({
      id: groupDeleteRequestsTable.id,
      groupId: groupDeleteRequestsTable.groupId,
      groupName: groupsTable.name,
      reason: groupDeleteRequestsTable.reason,
      status: groupDeleteRequestsTable.status,
      reviewNote: groupDeleteRequestsTable.reviewNote,
      requestedAt: groupDeleteRequestsTable.requestedAt,
      reviewedAt: groupDeleteRequestsTable.reviewedAt,
    })
    .from(groupDeleteRequestsTable)
    .leftJoin(groupsTable, eq(groupDeleteRequestsTable.groupId, groupsTable.id))
    .where(eq(groupDeleteRequestsTable.requestedBy, userId))
    .orderBy(groupDeleteRequestsTable.requestedAt);
  res.json(rows);
});

router.get("/groups/:groupId/delete-request", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId as string, 10);
  const [existing] = await db.select().from(groupDeleteRequestsTable)
    .where(eq(groupDeleteRequestsTable.groupId, groupId))
    .limit(1);
  res.json(existing ?? null);
});

export { getGroupWithCounts };
export default router;
