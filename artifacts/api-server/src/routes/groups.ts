import { Router, type IRouter } from "express";
import { db, groupsTable, groupMembersTable, usersTable, contributionCyclesTable, contributionsTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { CreateGroupBody, UpdateGroupBody, InviteMemberBody } from "@workspace/api-zod";
import { createAuditLog } from "../lib/auditLog";
import { formatUser } from "./users";
import { createGroupInvitation } from "./invitations";

const router: IRouter = Router();

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
    currency: g.currency ?? "KES",
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

/** Returns true if the session user is the group's admin or a super_admin. */
function isGroupAdmin(
  sessionUserId: number | undefined,
  sessionRole: string | undefined,
  group: typeof groupsTable.$inferSelect,
): boolean {
  return sessionRole === "super_admin" || sessionUserId === group.adminId;
}

router.get("/groups", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const role = req.session!.userRole;

  let groups: (typeof groupsTable.$inferSelect)[];

  if (role === "super_admin") {
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
  const userId = req.session!.userId!;

  const [group] = await db.insert(groupsTable).values({
    name,
    adminId: userId,
    organizationId: organizationId ?? null,
    currency: (currency ?? "KES").toUpperCase(),
    contributionAmount: String(contributionAmount),
    schedule: schedule ?? "bi-weekly",
    maxMembers: maxMembers ?? 5,
  }).returning();

  await db.insert(groupMembersTable).values({
    userId,
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

  await createAuditLog({ action: "group.create", performedBy: userId, targetType: "group", targetId: group.id });

  res.status(201).json(await getGroupWithCounts(group));
});

router.get("/groups/:groupId", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId, 10);
  const userId = req.session!.userId!;
  const role = req.session!.userRole;

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  // Only members, the group admin, or super_admin can view group details
  if (role !== "super_admin" && group.adminId !== userId) {
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
  const groupId = parseInt(req.params.groupId, 10);

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

router.get("/groups/:groupId/members", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId, 10);
  const userId = req.session!.userId!;
  const role = req.session!.userRole;

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  // Only members, the group admin, or super_admin can view the member list
  if (role !== "super_admin" && group.adminId !== userId) {
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
  const groupId = parseInt(req.params.groupId, 10);

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
  const groupId = parseInt(req.params.groupId, 10);
  const targetUserId = parseInt(req.params.userId, 10);

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

  res.json({ success: true });
});

router.post("/groups/:groupId/pause", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId, 10);

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
  const groupId = parseInt(req.params.groupId, 10);

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

export { getGroupWithCounts };
export default router;
