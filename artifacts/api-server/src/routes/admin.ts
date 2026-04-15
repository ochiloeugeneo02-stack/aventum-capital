import { Router, type IRouter } from "express";
import { db, auditLogsTable, usersTable, groupsTable, groupMembersTable, contributionCyclesTable, contributionsTable, payoutsTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireRole } from "../lib/auth";
import { TriggerPayoutBody } from "@workspace/api-zod";
import { createAuditLog } from "../lib/auditLog";
import { formatUser } from "./users";
import { formatPayout } from "./payouts";

const router: IRouter = Router();

router.get("/admin/audit-logs", requireRole("super_admin"), async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);
  const offset = (page - 1) * limit;

  const [logs, countResult] = await Promise.all([
    db.select().from(auditLogsTable).orderBy(sql`${auditLogsTable.createdAt} DESC`).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(auditLogsTable),
  ]);

  // Batch user fetch — avoid N+1
  const performerIds = [...new Set(logs.map((l) => l.performedBy))];
  const performers = performerIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, performerIds))
    : [];
  const userMap = new Map(performers.map((u) => [u.id, u]));

  const formattedLogs = logs.map((log) => ({
    id: log.id,
    action: log.action,
    performedBy: log.performedBy,
    targetType: log.targetType,
    targetId: log.targetId ?? null,
    details: log.details ?? null,
    createdAt: log.createdAt.toISOString(),
    user: userMap.has(log.performedBy) ? formatUser(userMap.get(log.performedBy)!) : null,
  }));

  res.json({
    logs: formattedLogs,
    total: Number(countResult[0]?.count ?? 0),
    page,
    limit,
  });
});

router.post("/admin/payout-trigger", requireRole("super_admin", "group_admin"), async (req, res): Promise<void> => {
  const parsed = TriggerPayoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { groupId, cycleId } = parsed.data;

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  // Prevent duplicate payouts for the same cycle
  const [existingPayout] = await db.select().from(payoutsTable)
    .where(and(eq(payoutsTable.groupId, groupId), eq(payoutsTable.cycleId, cycleId)))
    .limit(1);
  if (existingPayout) {
    res.status(409).json({ error: "A payout already exists for this cycle", payoutId: existingPayout.id });
    return;
  }

  const members = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const rotationMember = members.find((m) => m.rotationOrder === group.currentRotationIndex);

  if (!rotationMember) {
    res.status(400).json({ error: "No eligible recipient found for current rotation index" });
    return;
  }

  const totalPayout = parseFloat(group.contributionAmount as unknown as string) * members.length;

  const [payout] = await db.insert(payoutsTable).values({
    groupId,
    cycleId,
    recipientId: rotationMember.userId,
    amount: String(totalPayout),
    status: "pending",
  }).returning();

  await createAuditLog({
    action: "payout.trigger",
    performedBy: req.session!.userId!,
    targetType: "payout",
    targetId: payout.id,
    details: `Manual trigger for group ${groupId}, cycle ${cycleId}`,
  });

  res.json(await formatPayout(payout));
});

export default router;
