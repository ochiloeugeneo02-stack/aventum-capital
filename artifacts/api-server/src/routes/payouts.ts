import { Router, type IRouter } from "express";
import { db, payoutsTable, usersTable, groupsTable, financeApprovalRequestsTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole, requirePermission } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { createAuditLog } from "../lib/auditLog";
import { formatUser } from "./users";

const router: IRouter = Router();
const TRANSACTION_FEE_RATE = 0.03;

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
      createdAt: group.createdAt.toISOString(),
    } : null,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/payouts", requireAuth, asyncHandler(async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const groupId = req.query.groupId ? parseInt(String(req.query.groupId), 10) : undefined;

  const conditions = [eq(payoutsTable.recipientId, userId)];
  if (groupId) conditions.push(eq(payoutsTable.groupId, groupId));

  const payouts = await db.select().from(payoutsTable)
    .where(and(...conditions))
    .orderBy(sql`${payoutsTable.createdAt} DESC`);

  const result = await Promise.all(payouts.map(formatPayout));
  res.json(result);
}));

router.get("/payouts/all", requirePermission("finance:view"), asyncHandler(async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);
  const offset = (page - 1) * limit;

  const [payouts, countResult] = await Promise.all([
    db.select().from(payoutsTable).orderBy(sql`${payoutsTable.createdAt} DESC`).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(payoutsTable),
  ]);

  const recipientIds = [...new Set(payouts.map((p) => p.recipientId))];
  const groupIds = [...new Set(payouts.map((p) => p.groupId))];

  const [recipients, groups] = await Promise.all([
    recipientIds.length > 0 ? db.select().from(usersTable).where(inArray(usersTable.id, recipientIds)) : Promise.resolve([]),
    groupIds.length > 0 ? db.select().from(groupsTable).where(inArray(groupsTable.id, groupIds)) : Promise.resolve([]),
  ]);

  const recipientMap = new Map(recipients.map((u) => [u.id, u]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const result = payouts.map((p) => {
    const recipient = recipientMap.get(p.recipientId);
    const group = groupMap.get(p.groupId);
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
        createdAt: group.createdAt.toISOString(),
      } : null,
      createdAt: p.createdAt.toISOString(),
    };
  });

  res.json({
    payouts: result,
    total: Number(countResult[0]?.count ?? 0),
    page,
    limit,
  });
}));

router.post("/payouts/:payoutId/complete", requirePermission("payouts:manage"), asyncHandler(async (req, res): Promise<void> => {
  const payoutId = parseInt(req.params.payoutId as string, 10);
  const sessionUserId = req.session!.userId!;
  const sessionRole = req.session!.userRole;

  const [payout] = await db.select().from(payoutsTable).where(eq(payoutsTable.id, payoutId)).limit(1);
  if (!payout) {
    res.status(404).json({ error: "Payout not found" });
    return;
  }

  // Determine authorization level for this completion attempt
  const isStaffApprover = ["super_admin", "ceo"].includes(sessionRole ?? "");
  const isFinanceAdmin = req.session!.isFinanceAdmin === true;
  const isFinanceStaff = sessionRole === "finance" && !isFinanceAdmin;

  if (!isStaffApprover && !isFinanceAdmin && !isFinanceStaff) {
    // Group admins can only complete payouts for their own group
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, payout.groupId)).limit(1);
    if (!group || group.adminId !== sessionUserId) {
      res.status(403).json({ error: "You can only complete payouts for groups you administer" });
      return;
    }
  }

  // Finance staff (non-CFO) must route through dual-control approval queue
  if (isFinanceStaff) {
    if (payout.status === "paid") {
      res.status(400).json({ error: "Payout has already been completed" });
      return;
    }
    const [approval] = await db.insert(financeApprovalRequestsTable).values({
      requestedBy: sessionUserId,
      actionType: "payout_transfer",
      actionPayload: JSON.stringify({ payoutId }),
      status: "pending",
    }).returning();
    await createAuditLog({
      action: "finance.approval_requested",
      performedBy: sessionUserId,
      targetType: "payout",
      targetId: payout.id,
      details: `Finance staff requested payout completion for payout #${payoutId}; routed to approval queue as #${approval.id}`,
    });
    res.status(202).json({ approvalRequired: true, approvalId: approval.id, message: "Payout completion queued for CFO/CEO approval." });
    return;
  }

  if (payout.status === "paid") {
    res.status(400).json({ error: "Payout has already been completed" });
    return;
  }

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, payout.groupId)).limit(1);
  const amount = parseFloat(payout.amount as unknown as string);
  const transactionFee = Number((amount * TRANSACTION_FEE_RATE).toFixed(2));
  const netAmount = Number((amount - transactionFee).toFixed(2));

  const [updated] = await db.update(payoutsTable)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(payoutsTable.id, payoutId))
    .returning();

  await createAuditLog({
    action: "payout.complete",
    performedBy: sessionUserId,
    targetType: "payout",
    targetId: updated.id,
    details: `Gross payout: ${group?.currency ?? "USD"} ${amount.toLocaleString()}; transaction fee: ${transactionFee.toLocaleString()} (${Number(TRANSACTION_FEE_RATE * 100).toFixed(0)}%); net payout: ${netAmount.toLocaleString()}`,
  });

  res.json({
    ...(await formatPayout(updated)),
    transactionFee,
    netAmount,
    feeRate: TRANSACTION_FEE_RATE,
  });
}));

export { formatPayout };
export default router;
