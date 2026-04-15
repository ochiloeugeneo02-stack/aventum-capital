import { Router, type IRouter } from "express";
import { db, groupsTable, groupMembersTable, usersTable, contributionCyclesTable, contributionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { CreateGroupBody, UpdateGroupBody, InviteMemberBody } from "@workspace/api-zod";
import { createAuditLog } from "../lib/auditLog";

const router: IRouter = Router();

export function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    organizationId: u.organizationId ?? null,
    phoneNumber: u.phoneNumber ?? null,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  };
}

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

router.get("/groups", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const role = req.session!.userRole;

  let groups: (typeof groupsTable.$inferSelect)[];

  if (role === "super_admin") {
    groups = await db.select().from(groupsTable).orderBy(groupsTable.createdAt);
  } else {
    const memberships = await db.select().from(groupMembersTable).where(eq(groupMembersTable.userId, userId));
    const adminGroups = await db.select().from(groupsTable).where(eq(groupsTable.adminId, userId));
    const memberGroupIds = new Set(memberships.map((m) => m.groupId));
    const allIds = [...memberGroupIds, ...adminGroups.map((g) => g.id)];
    const uniqueIds = [...new Set(allIds)];

    if (uniqueIds.length === 0) {
      res.json([]);
      return;
    }

    groups = await db.select().from(groupsTable).where(
      sql`${groupsTable.id} = ANY(${sql.raw(`ARRAY[${uniqueIds.join(",")}]`)})`
    );
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

  const { name, contributionAmount, schedule, maxMembers, organizationId } = parsed.data;
  const userId = req.session!.userId!;

  const [group] = await db.insert(groupsTable).values({
    name,
    adminId: userId,
    organizationId: organizationId ?? null,
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
  const raw = Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId;
  const groupId = parseInt(raw, 10);

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const [members, currentCycle] = await Promise.all([
    db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId)).orderBy(groupMembersTable.rotationOrder),
    db.select().from(contributionCyclesTable)
      .where(and(eq(contributionCyclesTable.groupId, groupId), eq(contributionCyclesTable.cycleNumber, group.currentCycle)))
      .limit(1),
  ]);

  const userIds = members.map((m) => m.userId);
  let users: (typeof usersTable.$inferSelect)[] = [];
  if (userIds.length > 0) {
    users = await db.select().from(usersTable).where(
      sql`${usersTable.id} = ANY(${sql.raw(`ARRAY[${userIds.join(",")}]`)})`
    );
  }

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
  });
});

router.put("/groups/:groupId", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId;
  const groupId = parseInt(raw, 10);

  const parsed = UpdateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.contributionAmount !== undefined) updateData.contributionAmount = String(parsed.data.contributionAmount);
  if (parsed.data.schedule !== undefined) updateData.schedule = parsed.data.schedule;

  const [group] = await db.update(groupsTable).set(updateData).where(eq(groupsTable.id, groupId)).returning();
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  res.json(await getGroupWithCounts(group));
});

router.post("/groups/:groupId/invite", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId;
  const groupId = parseInt(raw, 10);

  const parsed = InviteMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User with that email not found" });
    return;
  }

  const existing = await db.select().from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id)))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "User is already a member" });
    return;
  }

  const memberCount = await db.select({ count: sql<number>`count(*)` })
    .from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const order = parsed.data.rotationOrder ?? Number(memberCount[0]?.count ?? 0);

  await db.insert(groupMembersTable).values({
    userId: user.id,
    groupId,
    rotationOrder: order,
    hasReceivedPayout: false,
  });

  await createAuditLog({ action: "group.invite_member", performedBy: req.session!.userId!, targetType: "group", targetId: groupId, details: user.email });

  res.json({ success: true, message: `${user.name} has been invited to the group` });
});

router.get("/groups/:groupId/members", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId;
  const groupId = parseInt(raw, 10);

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const members = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId)).orderBy(groupMembersTable.rotationOrder);
  const userIds = members.map((m) => m.userId);
  let users: (typeof usersTable.$inferSelect)[] = [];
  if (userIds.length > 0) {
    users = await db.select().from(usersTable).where(
      sql`${usersTable.id} = ANY(${sql.raw(`ARRAY[${userIds.join(",")}]`)})`
    );
  }

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

router.post("/groups/:groupId/pause", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId;
  const groupId = parseInt(raw, 10);

  const [group] = await db.update(groupsTable).set({ status: "paused" }).where(eq(groupsTable.id, groupId)).returning();
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  await createAuditLog({ action: "group.pause", performedBy: req.session!.userId!, targetType: "group", targetId: groupId });
  res.json(await getGroupWithCounts(group));
});

router.post("/groups/:groupId/resume", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId;
  const groupId = parseInt(raw, 10);

  const [group] = await db.update(groupsTable).set({ status: "active" }).where(eq(groupsTable.id, groupId)).returning();
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  await createAuditLog({ action: "group.resume", performedBy: req.session!.userId!, targetType: "group", targetId: groupId });
  res.json(await getGroupWithCounts(group));
});

export default router;
