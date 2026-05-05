import { Router, type IRouter } from "express";
import { db, groupMessagesTable, groupMembersTable, groupsTable, usersTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, requireStaffGate, hasPermission } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function isMember(userId: number, groupId: number): Promise<boolean> {
  const rows = await db
    .select()
    .from(groupMembersTable)
    .where(and(eq(groupMembersTable.userId, userId), eq(groupMembersTable.groupId, groupId)))
    .limit(1);
  if (rows.length > 0) return true;
  const [group] = await db.select({ adminId: groupsTable.adminId }).from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  return group?.adminId === userId;
}

router.get("/groups/:groupId/messages", requireAuth, requireStaffGate, asyncHandler(async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId as string);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group ID" }); return; }

  const userId = req.session.userId!;
  const userRole = req.session.userRole;

  const member = hasPermission(userRole ?? "", "chat:manage") ? true : await isMember(userId, groupId);
  if (!member) { res.status(403).json({ error: "Not a member of this group" }); return; }

  const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);
  const messages = await db
    .select({
      id: groupMessagesTable.id,
      groupId: groupMessagesTable.groupId,
      userId: groupMessagesTable.userId,
      content: groupMessagesTable.content,
      messageType: groupMessagesTable.messageType,
      createdAt: groupMessagesTable.createdAt,
      userName: usersTable.name,
      userAvatar: usersTable.avatar,
    })
    .from(groupMessagesTable)
    .leftJoin(usersTable, eq(usersTable.id, groupMessagesTable.userId))
    .where(eq(groupMessagesTable.groupId, groupId))
    .orderBy(asc(groupMessagesTable.createdAt))
    .limit(limit);

  res.json(messages);
}));

router.post("/groups/:groupId/messages", requireAuth, requireStaffGate, asyncHandler(async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId as string);
  if (isNaN(groupId)) { res.status(400).json({ error: "Invalid group ID" }); return; }

  const userId = req.session.userId!;
  const userRole = req.session.userRole;
  const member = hasPermission(userRole ?? "", "chat:manage") ? true : await isMember(userId, groupId);
  if (!member) { res.status(403).json({ error: "Not a member of this group" }); return; }

  const { content } = req.body;
  if (!content || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "Message content is required" });
    return;
  }

  if (content.trim().length > 1000) {
    res.status(400).json({ error: "Message is too long (max 1000 characters)" });
    return;
  }

  const [message] = await db.insert(groupMessagesTable).values({
    groupId,
    userId,
    content: content.trim(),
    messageType: "text",
  }).returning();

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  logger.info({ userId, groupId }, "Group message sent");
  res.status(201).json({ ...message, userName: user?.name ?? "Unknown" });
}));

router.delete("/groups/:groupId/messages/:messageId", requireAuth, requireStaffGate, asyncHandler(async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId as string);
  const messageId = parseInt(req.params.messageId as string);
  if (isNaN(groupId) || isNaN(messageId)) { res.status(400).json({ error: "Invalid IDs" }); return; }

  const userId = req.session.userId!;
  const userRole = req.session.userRole;

  const [message] = await db
    .select()
    .from(groupMessagesTable)
    .where(and(eq(groupMessagesTable.id, messageId), eq(groupMessagesTable.groupId, groupId)))
    .limit(1);

  if (!message) { res.status(404).json({ error: "Message not found" }); return; }

  const canDelete = hasPermission(userRole ?? "", "chat:manage") || message.userId === userId;
  if (!canDelete) {
    const admins = await db.select().from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId)))
      .limit(1);
    if (admins.length === 0) { res.status(403).json({ error: "Cannot delete this message" }); return; }
  }

  await db.delete(groupMessagesTable).where(eq(groupMessagesTable.id, messageId));
  res.json({ success: true });
}));

export default router;
