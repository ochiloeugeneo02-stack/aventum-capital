import { Router, type IRouter } from "express";
import { db, auditLogsTable, usersTable, groupsTable, groupMembersTable, contributionCyclesTable, contributionsTable, payoutsTable, groupDeleteRequestsTable } from "@workspace/db";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { requireRole } from "../lib/auth";
import { TriggerPayoutBody } from "@workspace/api-zod";
import { createAuditLog } from "../lib/auditLog";
import { formatUser } from "./users";
import { formatPayout } from "./payouts";
import { logger } from "../lib/logger";

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

// ── Delete Request Management ─────────────────────────────────────────────────

router.get("/admin/delete-requests", requireRole("super_admin"), async (req, res): Promise<void> => {
  const requests = await db.select().from(groupDeleteRequestsTable).orderBy(desc(groupDeleteRequestsTable.requestedAt));

  const groupIds = [...new Set(requests.map(r => r.groupId))];
  const userIds = [...new Set([...requests.map(r => r.requestedBy), ...requests.map(r => r.reviewedBy).filter(Boolean) as number[]])];

  const [groups, users] = await Promise.all([
    groupIds.length > 0 ? db.select().from(groupsTable).where(inArray(groupsTable.id, groupIds)) : Promise.resolve([]),
    userIds.length > 0 ? db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : Promise.resolve([]),
  ]);

  const groupMap = new Map(groups.map(g => [g.id, g]));
  const userMap = new Map(users.map(u => [u.id, u]));

  res.json(requests.map(r => ({
    id: r.id,
    groupId: r.groupId,
    group: groupMap.has(r.groupId) ? { id: groupMap.get(r.groupId)!.id, name: groupMap.get(r.groupId)!.name, status: groupMap.get(r.groupId)!.status, currency: groupMap.get(r.groupId)!.currency, contributionAmount: groupMap.get(r.groupId)!.contributionAmount } : null,
    requestedBy: r.requestedBy,
    requester: userMap.has(r.requestedBy) ? { name: userMap.get(r.requestedBy)!.name, email: userMap.get(r.requestedBy)!.email } : null,
    reason: r.reason,
    status: r.status,
    reviewedBy: r.reviewedBy,
    reviewer: r.reviewedBy && userMap.has(r.reviewedBy) ? { name: userMap.get(r.reviewedBy)!.name } : null,
    reviewNote: r.reviewNote,
    disbursementNote: r.disbursementNote,
    requestedAt: r.requestedAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
  })));
});

router.post("/admin/delete-requests/:id/approve", requireRole("super_admin"), async (req, res): Promise<void> => {
  const reqId = parseInt(req.params.id, 10);
  const { disbursementNote, reviewNote } = req.body as { disbursementNote?: string; reviewNote?: string };
  const adminId = req.session!.userId!;

  const [deleteReq] = await db.select().from(groupDeleteRequestsTable).where(eq(groupDeleteRequestsTable.id, reqId)).limit(1);
  if (!deleteReq) { res.status(404).json({ error: "Request not found" }); return; }
  if (deleteReq.status !== "pending") { res.status(409).json({ error: "Request already reviewed" }); return; }

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, deleteReq.groupId)).limit(1);
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  await db.update(groupDeleteRequestsTable)
    .set({ status: "approved", reviewedBy: adminId, reviewNote: reviewNote ?? null, disbursementNote: disbursementNote ?? null, reviewedAt: new Date() })
    .where(eq(groupDeleteRequestsTable.id, reqId));

  await db.update(groupsTable).set({ status: "deleted" }).where(eq(groupsTable.id, group.id));

  await createAuditLog({
    action: "group.delete_approved",
    performedBy: adminId,
    targetType: "group",
    targetId: group.id,
    details: `Delete request #${reqId} approved. ${disbursementNote ?? ""}`,
  });

  logger.info({ groupId: group.id, reqId }, "Group delete request approved by super admin");
  res.json({ success: true, message: `Group "${group.name}" has been closed and marked for deletion.` });
});

router.post("/admin/delete-requests/:id/reject", requireRole("super_admin"), async (req, res): Promise<void> => {
  const reqId = parseInt(req.params.id, 10);
  const { reviewNote } = req.body as { reviewNote?: string };
  const adminId = req.session!.userId!;

  const [deleteReq] = await db.select().from(groupDeleteRequestsTable).where(eq(groupDeleteRequestsTable.id, reqId)).limit(1);
  if (!deleteReq) { res.status(404).json({ error: "Request not found" }); return; }
  if (deleteReq.status !== "pending") { res.status(409).json({ error: "Request already reviewed" }); return; }

  await db.update(groupDeleteRequestsTable)
    .set({ status: "rejected", reviewedBy: adminId, reviewNote: reviewNote ?? null, reviewedAt: new Date() })
    .where(eq(groupDeleteRequestsTable.id, reqId));

  await createAuditLog({
    action: "group.delete_rejected",
    performedBy: adminId,
    targetType: "group",
    targetId: deleteReq.groupId,
    details: `Delete request #${reqId} rejected. ${reviewNote ?? ""}`,
  });

  res.json({ success: true, message: "Delete request rejected." });
});

// ── All Groups (super admin view) ─────────────────────────────────────────────

router.get("/admin/groups", requireRole("super_admin"), async (req, res): Promise<void> => {
  const groups = await db.select().from(groupsTable).orderBy(desc(groupsTable.createdAt));
  const adminIds = [...new Set(groups.map(g => g.adminId))];
  const admins = adminIds.length > 0 ? await db.select().from(usersTable).where(inArray(usersTable.id, adminIds)) : [];
  const adminMap = new Map(admins.map(u => [u.id, u]));

  const memberCounts = await db.select({ groupId: groupMembersTable.groupId, count: sql<number>`count(*)` })
    .from(groupMembersTable)
    .groupBy(groupMembersTable.groupId);
  const countMap = new Map(memberCounts.map(m => [m.groupId, Number(m.count)]));

  res.json(groups.map(g => ({
    id: g.id,
    name: g.name,
    status: g.status,
    currency: g.currency,
    contributionAmount: parseFloat(g.contributionAmount as unknown as string),
    schedule: g.schedule,
    maxMembers: g.maxMembers,
    currentCycle: g.currentCycle,
    totalMembers: countMap.get(g.id) ?? 0,
    admin: adminMap.has(g.adminId) ? { id: adminMap.get(g.adminId)!.id, name: adminMap.get(g.adminId)!.name, email: adminMap.get(g.adminId)!.email } : null,
    createdAt: g.createdAt.toISOString(),
  })));
});

export default router;
