import { Router, type IRouter } from "express";
import { db, usersTable, groupsTable, groupMembersTable, contributionsTable, payoutsTable, contributionCyclesTable, organizationsTable, auditLogsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { formatUser } from "./users";
import { formatPayout } from "./payouts";
import { formatContribution } from "./contributions";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const memberships = await db.select().from(groupMembersTable).where(eq(groupMembersTable.userId, userId)).limit(1);
  let currentGroup = null;
  let contributionStatus: "paid" | "pending" | "none" = "none";
  let nextDueDate = null;
  let upcomingRecipient = null;
  let cycleId = null;

  if (memberships.length > 0) {
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, memberships[0].groupId)).limit(1);
    if (group) {
      currentGroup = {
        id: group.id,
        name: group.name,
        adminId: group.adminId,
        organizationId: group.organizationId ?? null,
        contributionAmount: parseFloat(group.contributionAmount as unknown as string),
        schedule: group.schedule,
        maxMembers: group.maxMembers,
        currentCycle: group.currentCycle,
        currentRotationIndex: group.currentRotationIndex,
        status: group.status,
        totalMembers: 0,
        paidCount: 0,
        createdAt: group.createdAt.toISOString(),
      };

      const currentCycle = await db.select().from(contributionCyclesTable)
        .where(and(eq(contributionCyclesTable.groupId, group.id), eq(contributionCyclesTable.cycleNumber, group.currentCycle)))
        .limit(1);

      if (currentCycle.length > 0) {
        cycleId = currentCycle[0].id;
        nextDueDate = currentCycle[0].dueDate ? currentCycle[0].dueDate.toISOString() : null;

        const paid = await db.select().from(contributionsTable)
          .where(and(
            eq(contributionsTable.userId, userId),
            eq(contributionsTable.cycleId, currentCycle[0].id),
            eq(contributionsTable.status, "paid")
          )).limit(1);

        contributionStatus = paid.length > 0 ? "paid" : "pending";
      }

      const allMembers = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, group.id));
      const rotationMember = allMembers.find((m) => m.rotationOrder === group.currentRotationIndex);
      if (rotationMember) {
        const [recipientUser] = await db.select().from(usersTable).where(eq(usersTable.id, rotationMember.userId)).limit(1);
        if (recipientUser) upcomingRecipient = formatUser(recipientUser);
      }
    }
  }

  const totalContribResult = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
    .from(contributionsTable)
    .where(and(eq(contributionsTable.userId, userId), eq(contributionsTable.status, "paid")));
  const totalContributed = parseFloat(totalContribResult[0]?.total ?? "0");

  const recentPayouts = await db.select().from(payoutsTable)
    .where(eq(payoutsTable.recipientId, userId))
    .orderBy(sql`${payoutsTable.createdAt} DESC`)
    .limit(5);

  const recentContributions = await db.select().from(contributionsTable)
    .where(eq(contributionsTable.userId, userId))
    .orderBy(sql`${contributionsTable.createdAt} DESC`)
    .limit(5);

  const [formattedPayouts, formattedContribs] = await Promise.all([
    Promise.all(recentPayouts.map(formatPayout)),
    Promise.all(recentContributions.map((c) => formatContribution(c, false))),
  ]);

  res.json({
    user: formatUser(user),
    currentGroup,
    contributionStatus,
    totalContributed,
    nextDueDate,
    upcomingRecipient,
    cycleId,
    recentPayouts: formattedPayouts,
    recentContributions: formattedContribs,
  });
});

router.get("/dashboard/admin-stats", requireRole("super_admin"), async (_req, res): Promise<void> => {
  const [users, groups, orgs, activeGroups, totalContrib, totalPaidOut, pendingPayouts] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
    db.select({ count: sql<number>`count(*)` }).from(groupsTable),
    db.select({ count: sql<number>`count(*)` }).from(organizationsTable),
    db.select({ count: sql<number>`count(*)` }).from(groupsTable).where(eq(groupsTable.status, "active")),
    db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(contributionsTable).where(eq(contributionsTable.status, "paid")),
    db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(payoutsTable).where(eq(payoutsTable.status, "paid")),
    db.select({ count: sql<number>`count(*)` }).from(payoutsTable).where(eq(payoutsTable.status, "pending")),
  ]);

  res.json({
    totalUsers: Number(users[0]?.count ?? 0),
    totalGroups: Number(groups[0]?.count ?? 0),
    totalOrganizations: Number(orgs[0]?.count ?? 0),
    activeGroups: Number(activeGroups[0]?.count ?? 0),
    totalContributed: parseFloat(totalContrib[0]?.total ?? "0"),
    totalPaidOut: parseFloat(totalPaidOut[0]?.total ?? "0"),
    pendingPayouts: Number(pendingPayouts[0]?.count ?? 0),
    failedTransactions: 0,
  });
});

router.get("/dashboard/activity", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const role = req.session!.userRole;

  const contributions = await db.select().from(contributionsTable)
    .where(role === "super_admin" ? sql`true` : eq(contributionsTable.userId, userId))
    .orderBy(sql`${contributionsTable.createdAt} DESC`)
    .limit(5);

  const payouts = await db.select().from(payoutsTable)
    .where(role === "super_admin" ? sql`true` : eq(payoutsTable.recipientId, userId))
    .orderBy(sql`${payoutsTable.createdAt} DESC`)
    .limit(5);

  const activities: Array<{
    id: number;
    type: string;
    description: string;
    userId: number | null;
    groupId: number | null;
    amount: number | null;
    createdAt: string;
  }> = [];

  let idCounter = 1;
  for (const c of contributions) {
    activities.push({
      id: idCounter++,
      type: "contribution",
      description: `Contribution of KES ${parseFloat(c.amount as unknown as string).toLocaleString()} ${c.status}`,
      userId: c.userId,
      groupId: c.groupId,
      amount: parseFloat(c.amount as unknown as string),
      createdAt: c.createdAt.toISOString(),
    });
  }

  for (const p of payouts) {
    activities.push({
      id: idCounter++,
      type: "payout",
      description: `Payout of KES ${parseFloat(p.amount as unknown as string).toLocaleString()} - ${p.status}`,
      userId: p.recipientId,
      groupId: p.groupId,
      amount: parseFloat(p.amount as unknown as string),
      createdAt: p.createdAt.toISOString(),
    });
  }

  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(activities.slice(0, 10));
});

export default router;
