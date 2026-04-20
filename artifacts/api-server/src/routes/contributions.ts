import { Router, type IRouter } from "express";
import { db, contributionsTable, groupsTable, contributionCyclesTable, groupMembersTable, payoutsTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { PayContributionBody } from "@workspace/api-zod";
import { createAuditLog } from "../lib/auditLog";
import { formatUser } from "./users";
import { db as dbImport, usersTable } from "@workspace/db";
import { sendContributionReceiptEmail, sendContributionActivityEmail } from "../lib/email";

const router: IRouter = Router();

async function formatContribution(c: typeof contributionsTable.$inferSelect, includeRelations = true) {
  const base = {
    id: c.id,
    userId: c.userId,
    groupId: c.groupId,
    cycleId: c.cycleId,
    amount: parseFloat(c.amount as unknown as string),
    status: c.status,
    paidAt: c.paidAt ? c.paidAt.toISOString() : null,
    user: null as ReturnType<typeof formatUser> | null,
    group: null as unknown,
    createdAt: c.createdAt.toISOString(),
  };

  if (includeRelations) {
    const [user] = await dbImport.select().from(usersTable).where(eq(usersTable.id, c.userId)).limit(1);
    if (user) base.user = formatUser(user);
  }

  return base;
}

router.get("/contributions", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const groupId = req.query.groupId ? parseInt(String(req.query.groupId), 10) : undefined;
  const cycleId = req.query.cycleId ? parseInt(String(req.query.cycleId), 10) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;

  const conditions = [eq(contributionsTable.userId, userId)];
  if (groupId) conditions.push(eq(contributionsTable.groupId, groupId));
  if (cycleId) conditions.push(eq(contributionsTable.cycleId, cycleId));
  if (status) conditions.push(eq(contributionsTable.status, status));

  const contributions = await db.select().from(contributionsTable)
    .where(and(...conditions))
    .orderBy(sql`${contributionsTable.createdAt} DESC`);

  const userIds = [...new Set(contributions.map((c) => c.userId))];
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const result = contributions.map((c) => ({
    id: c.id,
    userId: c.userId,
    groupId: c.groupId,
    cycleId: c.cycleId,
    amount: parseFloat(c.amount as unknown as string),
    status: c.status,
    paidAt: c.paidAt ? c.paidAt.toISOString() : null,
    user: userMap.has(c.userId) ? formatUser(userMap.get(c.userId)!) : null,
    group: null,
    createdAt: c.createdAt.toISOString(),
  }));

  res.json(result);
});

router.post("/contributions/pay", requireAuth, async (req, res): Promise<void> => {
  const parsed = PayContributionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { groupId, cycleId } = parsed.data;
  const userId = req.session!.userId!;

  // Must be a member of the group
  const [membership] = await db.select().from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId)))
    .limit(1);
  if (!membership) {
    res.status(403).json({ error: "You are not a member of this group" });
    return;
  }

  // Group must exist and be active
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  if (group.status !== "active") {
    res.status(400).json({ error: `Group is currently ${group.status} and not accepting contributions` });
    return;
  }

  // Cycle must belong to this group and be active
  const [cycle] = await db.select().from(contributionCyclesTable)
    .where(and(eq(contributionCyclesTable.id, cycleId), eq(contributionCyclesTable.groupId, groupId)))
    .limit(1);
  if (!cycle) {
    res.status(404).json({ error: "Cycle not found for this group" });
    return;
  }
  if (cycle.status !== "active") {
    res.status(400).json({ error: "This cycle is no longer accepting contributions" });
    return;
  }

  // Already paid?
  const [existing] = await db.select().from(contributionsTable)
    .where(and(
      eq(contributionsTable.userId, userId),
      eq(contributionsTable.groupId, groupId),
      eq(contributionsTable.cycleId, cycleId),
    )).limit(1);

  if (existing?.status === "paid") {
    res.status(400).json({ error: "Already paid for this cycle" });
    return;
  }

  let contribution: typeof contributionsTable.$inferSelect;

  if (existing) {
    const [updated] = await db.update(contributionsTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(contributionsTable.id, existing.id))
      .returning();
    contribution = updated;
  } else {
    const [created] = await db.insert(contributionsTable).values({
      userId,
      groupId,
      cycleId,
      amount: group.contributionAmount,
      status: "paid",
      paidAt: new Date(),
    }).returning();
    contribution = created;
  }

  await createAuditLog({
    action: "contribution.pay",
    performedBy: userId,
    targetType: "contribution",
    targetId: contribution.id,
    details: `Amount: ${group.contributionAmount}`,
  });

  // Check if all active members have now paid for this cycle
  const allMembers = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const paidContribs = await db.select().from(contributionsTable)
    .where(and(eq(contributionsTable.cycleId, cycleId), eq(contributionsTable.status, "paid")));

  if (paidContribs.length >= allMembers.length) {
    // Find the current rotation recipient
    const rotationMember = allMembers.find((m) => m.rotationOrder === group.currentRotationIndex);

    if (rotationMember) {
      const totalPayout = parseFloat(group.contributionAmount as unknown as string) * allMembers.length;

      // Create the payout record
      await db.insert(payoutsTable).values({
        groupId,
        cycleId,
        recipientId: rotationMember.userId,
        amount: String(totalPayout),
        status: "pending",
      });

      // Mark the recipient as having received their payout
      await db.update(groupMembersTable)
        .set({ hasReceivedPayout: true })
        .where(eq(groupMembersTable.id, rotationMember.id));
    }

    // Close this cycle
    await db.update(contributionCyclesTable)
      .set({ status: "completed", endDate: new Date() })
      .where(eq(contributionCyclesTable.id, cycleId));

    const nextCycleNumber = group.currentCycle + 1;
    const nextRotationIndex = group.currentRotationIndex + 1;

    // Determine group status after advance: if everyone has received a payout, mark complete
    const allPaidOut = nextRotationIndex >= allMembers.length;
    const newGroupStatus = allPaidOut ? "completed" : "active";

    // Open the next cycle (unless all rotations are done)
    if (!allPaidOut) {
      const dueDate = new Date();
      if (group.schedule === "weekly") {
        dueDate.setDate(dueDate.getDate() + 7);
      } else if (group.schedule === "monthly") {
        dueDate.setMonth(dueDate.getMonth() + 1);
      } else {
        dueDate.setDate(dueDate.getDate() + 14); // bi-weekly default
      }

      await db.insert(contributionCyclesTable).values({
        groupId,
        cycleNumber: nextCycleNumber,
        status: "active",
        dueDate,
      });
    }

    // Advance the group's cycle and rotation counters
    await db.update(groupsTable).set({
      currentCycle: nextCycleNumber,
      currentRotationIndex: nextRotationIndex,
      status: newGroupStatus,
    }).where(eq(groupsTable.id, groupId));
  }

  // Fire-and-forget contribution email notifications
  const _allMembersSnap = allMembers;
  const _paidCountSnap = paidContribs.length;
  const _cycleSnap = cycle;
  const _contributionSnap = contribution;
  const _groupSnap = group;
  Promise.resolve().then(async () => {
    try {
      const appBaseUrl = (() => {
        const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
        return domain ? `https://${domain}` : `http://localhost:${process.env.PORT ?? 8080}`;
      })();
      const [contributor] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (!contributor) return;
      const amount = `${_groupSnap.currency} ${Number(_groupSnap.contributionAmount).toLocaleString()}`;
      const paidAt = _contributionSnap.paidAt ?? new Date();
      sendContributionReceiptEmail({
        email: contributor.email,
        name: contributor.name,
        groupName: _groupSnap.name,
        amount,
        cycleNumber: _cycleSnap.cycleNumber,
        paidAt,
        appBaseUrl,
      }).catch(() => {});
      const otherMemberIds = _allMembersSnap.map((m) => m.userId).filter((id) => id !== userId);
      if (otherMemberIds.length > 0) {
        const otherUsers = await db.select().from(usersTable).where(inArray(usersTable.id, otherMemberIds));
        otherUsers.forEach((member) => {
          sendContributionActivityEmail({
            email: member.email,
            recipientName: member.name,
            contributorName: contributor.name,
            groupName: _groupSnap.name,
            amount,
            cycleNumber: _cycleSnap.cycleNumber,
            paidAt,
            paidCount: _paidCountSnap,
            totalMembers: _allMembersSnap.length,
            appBaseUrl,
          }).catch(() => {});
        });
      }
    } catch (_err) {}
  });

  res.status(201).json(await formatContribution(contribution));
});

router.get("/contributions/all", requireRole("super_admin"), async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);
  const offset = (page - 1) * limit;

  const [contributions, countResult] = await Promise.all([
    db.select().from(contributionsTable).orderBy(sql`${contributionsTable.createdAt} DESC`).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(contributionsTable),
  ]);

  // Batch user fetch — avoids N+1
  const userIds = [...new Set(contributions.map((c) => c.userId))];
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const result = contributions.map((c) => ({
    id: c.id,
    userId: c.userId,
    groupId: c.groupId,
    cycleId: c.cycleId,
    amount: parseFloat(c.amount as unknown as string),
    status: c.status,
    paidAt: c.paidAt ? c.paidAt.toISOString() : null,
    user: userMap.has(c.userId) ? formatUser(userMap.get(c.userId)!) : null,
    group: null,
    createdAt: c.createdAt.toISOString(),
  }));

  res.json({
    contributions: result,
    total: Number(countResult[0]?.count ?? 0),
    page,
    limit,
  });
});

export { formatContribution };
export default router;
