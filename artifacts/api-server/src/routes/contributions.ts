import { Router, type IRouter } from "express";
import { db, contributionsTable, groupsTable, contributionCyclesTable, groupMembersTable, payoutsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { PayContributionBody } from "@workspace/api-zod";
import { createAuditLog } from "../lib/auditLog";
import { formatUser } from "./users";
import { db as dbImport, usersTable } from "@workspace/db";

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

  let query = db.select().from(contributionsTable).where(eq(contributionsTable.userId, userId));

  const conditions = [eq(contributionsTable.userId, userId)];
  if (groupId) conditions.push(eq(contributionsTable.groupId, groupId));
  if (cycleId) conditions.push(eq(contributionsTable.cycleId, cycleId));
  if (status) conditions.push(eq(contributionsTable.status, status));

  const contributions = await db.select().from(contributionsTable)
    .where(and(...conditions))
    .orderBy(sql`${contributionsTable.createdAt} DESC`);

  const result = await Promise.all(contributions.map((c) => formatContribution(c)));
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

  const existing = await db.select().from(contributionsTable)
    .where(and(
      eq(contributionsTable.userId, userId),
      eq(contributionsTable.groupId, groupId),
      eq(contributionsTable.cycleId, cycleId),
    )).limit(1);

  if (existing.length > 0 && existing[0].status === "paid") {
    res.status(400).json({ error: "Already paid for this cycle" });
    return;
  }

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  let contribution: typeof contributionsTable.$inferSelect;

  if (existing.length > 0) {
    const [updated] = await db.update(contributionsTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(contributionsTable.id, existing[0].id))
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

  const allMembers = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const paidContribs = await db.select().from(contributionsTable)
    .where(and(eq(contributionsTable.cycleId, cycleId), eq(contributionsTable.status, "paid")));

  if (paidContribs.length >= allMembers.length) {
    const rotationMember = allMembers.find((m) => m.rotationOrder === group.currentRotationIndex);
    if (rotationMember) {
      const totalPayout = parseFloat(group.contributionAmount as unknown as string) * allMembers.length;
      await db.insert(payoutsTable).values({
        groupId,
        cycleId,
        recipientId: rotationMember.userId,
        amount: String(totalPayout),
        status: "pending",
      });

      await db.update(groupsTable).set({ currentRotationIndex: group.currentRotationIndex + 1 }).where(eq(groupsTable.id, groupId));
    }
  }

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

  const result = await Promise.all(contributions.map((c) => formatContribution(c)));

  res.json({
    contributions: result,
    total: Number(countResult[0]?.count ?? 0),
    page,
    limit,
  });
});

export { formatContribution };
export default router;
