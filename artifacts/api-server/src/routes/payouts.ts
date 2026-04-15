import { Router, type IRouter } from "express";
import { db, payoutsTable, usersTable, groupsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { TriggerPayoutBody } from "@workspace/api-zod";
import { createAuditLog } from "../lib/auditLog";
import { formatUser } from "./users";

const router: IRouter = Router();

async function formatPayout(p: typeof payoutsTable.$inferSelect) {
  const [recipient] = await db.select().from(usersTable).where(eq(usersTable.id, p.recipientId)).limit(1);
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, p.groupId)).limit(1);

  return {
    id: p.id,
    groupId: p.groupId,
    cycleId: p.cycleId,
    recipientId: p.recipientId,
    amount: parseFloat(p.amount as unknown as string),
    status: p.status,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    recipient: recipient ? formatUser(recipient) : null,
    group: group ? {
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
    } : null,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/payouts", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const groupId = req.query.groupId ? parseInt(String(req.query.groupId), 10) : undefined;

  const conditions = [eq(payoutsTable.recipientId, userId)];
  if (groupId) conditions.push(eq(payoutsTable.groupId, groupId));

  const payouts = await db.select().from(payoutsTable)
    .where(and(...conditions))
    .orderBy(sql`${payoutsTable.createdAt} DESC`);

  const result = await Promise.all(payouts.map(formatPayout));
  res.json(result);
});

router.get("/payouts/all", requireRole("super_admin"), async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);
  const offset = (page - 1) * limit;

  const [payouts, countResult] = await Promise.all([
    db.select().from(payoutsTable).orderBy(sql`${payoutsTable.createdAt} DESC`).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(payoutsTable),
  ]);

  const result = await Promise.all(payouts.map(formatPayout));

  res.json({
    payouts: result,
    total: Number(countResult[0]?.count ?? 0),
    page,
    limit,
  });
});

router.post("/payouts/:payoutId/complete", requireRole("super_admin", "group_admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.payoutId) ? req.params.payoutId[0] : req.params.payoutId;
  const payoutId = parseInt(raw, 10);

  const [payout] = await db.update(payoutsTable)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(payoutsTable.id, payoutId))
    .returning();

  if (!payout) {
    res.status(404).json({ error: "Payout not found" });
    return;
  }

  await createAuditLog({
    action: "payout.complete",
    performedBy: req.session!.userId!,
    targetType: "payout",
    targetId: payout.id,
  });

  res.json(await formatPayout(payout));
});

export { formatPayout };
export default router;
