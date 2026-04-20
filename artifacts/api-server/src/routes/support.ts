import { Router } from "express";
import { db } from "@workspace/db";
import { supportTickets, supportMessages, usersTable, groupsTable } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

/* ── User: create a ticket ─────────────────────────────────────── */
router.post("/support/tickets", requireAuth, async (req, res) => {
  try {
    const { category = "general", subject, message, groupId } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: "Subject and message are required" });
    }

    const [ticket] = await db
      .insert(supportTickets)
      .values({
        userId: req.session!.userId!,
        category,
        groupId: groupId ? Number(groupId) : null,
        subject: subject.trim(),
        status: "open",
        priority: category === "exit_request" || category === "group_deletion" ? "high" : "normal",
      })
      .returning();

    await db.insert(supportMessages).values({
      ticketId: ticket.id,
      senderId: req.session!.userId!,
      message: message.trim(),
      isAdmin: false,
    });

    return res.status(201).json(ticket);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create ticket" });
  }
});

/* ── User: list their tickets ──────────────────────────────────── */
router.get("/support/tickets", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: supportTickets.id,
        category: supportTickets.category,
        subject: supportTickets.subject,
        status: supportTickets.status,
        priority: supportTickets.priority,
        groupId: supportTickets.groupId,
        groupName: groupsTable.name,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        closedAt: supportTickets.closedAt,
        unreadAdmin: sql<number>`(
          SELECT COUNT(*) FROM support_messages sm
          WHERE sm.ticket_id = ${supportTickets.id}
          AND sm.is_admin = TRUE
          AND sm.read_at IS NULL
        )`.mapWith(Number),
      })
      .from(supportTickets)
      .leftJoin(groupsTable, eq(supportTickets.groupId, groupsTable.id))
      .where(eq(supportTickets.userId, req.session!.userId!))
      .orderBy(desc(supportTickets.updatedAt));

    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

/* ── User: get single ticket with messages ─────────────────────── */
router.get("/support/tickets/:id", requireAuth, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);

    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(
        and(
          eq(supportTickets.id, ticketId),
          eq(supportTickets.userId, req.session!.userId!)
        )
      );

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    const messages = await db
      .select({
        id: supportMessages.id,
        message: supportMessages.message,
        isAdmin: supportMessages.isAdmin,
        readAt: supportMessages.readAt,
        createdAt: supportMessages.createdAt,
        senderName: usersTable.name,
      })
      .from(supportMessages)
      .leftJoin(usersTable, eq(supportMessages.senderId, usersTable.id))
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(supportMessages.createdAt);

    await db
      .update(supportMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(supportMessages.ticketId, ticketId),
          eq(supportMessages.isAdmin, true),
          sql`${supportMessages.readAt} IS NULL`
        )
      );

    return res.json({ ...ticket, messages });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

/* ── User: reply to ticket ─────────────────────────────────────── */
router.post("/support/tickets/:id/messages", requireAuth, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "Message required" });

    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(
        and(
          eq(supportTickets.id, ticketId),
          eq(supportTickets.userId, req.session!.userId!)
        )
      );

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.status === "closed") return res.status(400).json({ error: "Ticket is closed" });

    await db.insert(supportMessages).values({
      ticketId,
      senderId: req.session!.userId!,
      message: message.trim(),
      isAdmin: false,
    });

    await db.update(supportTickets).set({ updatedAt: new Date(), status: "open" }).where(eq(supportTickets.id, ticketId));

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send message" });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   SUPER ADMIN routes
═══════════════════════════════════════════════════════════════════ */

/* ── Admin: list all tickets ───────────────────────────────────── */
router.get("/admin/support/tickets", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const { status, category } = req.query as { status?: string; category?: string };

    const conditions = [];
    if (status && status !== "all") conditions.push(eq(supportTickets.status, status));
    if (category && category !== "all") conditions.push(eq(supportTickets.category, category));

    const rows = await db
      .select({
        id: supportTickets.id,
        category: supportTickets.category,
        subject: supportTickets.subject,
        status: supportTickets.status,
        priority: supportTickets.priority,
        groupId: supportTickets.groupId,
        groupName: groupsTable.name,
        userId: supportTickets.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        closedAt: supportTickets.closedAt,
        messageCount: sql<number>`(
          SELECT COUNT(*) FROM support_messages sm WHERE sm.ticket_id = ${supportTickets.id}
        )`.mapWith(Number),
        unreadCount: sql<number>`(
          SELECT COUNT(*) FROM support_messages sm
          WHERE sm.ticket_id = ${supportTickets.id}
          AND sm.is_admin = FALSE
          AND sm.read_at IS NULL
        )`.mapWith(Number),
      })
      .from(supportTickets)
      .leftJoin(usersTable, eq(supportTickets.userId, usersTable.id))
      .leftJoin(groupsTable, eq(supportTickets.groupId, groupsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(supportTickets.updatedAt));

    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

/* ── Admin: get single ticket with messages ────────────────────── */
router.get("/admin/support/tickets/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const ticketId = Number(req.params.id);

    const [ticket] = await db
      .select({
        id: supportTickets.id,
        category: supportTickets.category,
        subject: supportTickets.subject,
        status: supportTickets.status,
        priority: supportTickets.priority,
        groupId: supportTickets.groupId,
        groupName: groupsTable.name,
        userId: supportTickets.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        closedAt: supportTickets.closedAt,
      })
      .from(supportTickets)
      .leftJoin(usersTable, eq(supportTickets.userId, usersTable.id))
      .leftJoin(groupsTable, eq(supportTickets.groupId, groupsTable.id))
      .where(eq(supportTickets.id, ticketId));

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    const messages = await db
      .select({
        id: supportMessages.id,
        message: supportMessages.message,
        isAdmin: supportMessages.isAdmin,
        readAt: supportMessages.readAt,
        createdAt: supportMessages.createdAt,
        senderName: usersTable.name,
        senderId: supportMessages.senderId,
      })
      .from(supportMessages)
      .leftJoin(usersTable, eq(supportMessages.senderId, usersTable.id))
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(supportMessages.createdAt);

    await db
      .update(supportMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(supportMessages.ticketId, ticketId),
          eq(supportMessages.isAdmin, false),
          sql`${supportMessages.readAt} IS NULL`
        )
      );

    return res.json({ ...ticket, messages });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

/* ── Admin: reply to ticket ────────────────────────────────────── */
router.post("/admin/support/tickets/:id/messages", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "Message required" });

    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId));
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    await db.insert(supportMessages).values({
      ticketId,
      senderId: req.session!.userId!,
      message: message.trim(),
      isAdmin: true,
    });

    await db.update(supportTickets).set({ updatedAt: new Date(), status: "in_progress" }).where(eq(supportTickets.id, ticketId));

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send reply" });
  }
});

/* ── Admin: delete group via group_deletion ticket ─────────────── */
router.post("/admin/support/tickets/:id/delete-group", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const adminId = req.session!.userId!;

    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId));
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (!ticket.groupId) return res.status(400).json({ error: "No group associated with this ticket" });
    if (ticket.status === "closed") return res.status(409).json({ error: "Ticket already closed" });

    await db.update(groupsTable).set({ status: "deleted" }).where(eq(groupsTable.id, ticket.groupId));

    await db.insert(supportMessages).values({
      ticketId,
      senderId: adminId,
      message: "Your group deletion request has been approved. The group has been closed and marked as deleted. All records are preserved.",
      isAdmin: true,
    });

    await db.update(supportTickets).set({
      status: "closed",
      closedAt: new Date(),
      closedBy: adminId,
      updatedAt: new Date(),
    }).where(eq(supportTickets.id, ticketId));

    return res.json({ success: true, message: "Group deleted and ticket closed." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete group" });
  }
});

/* ── Admin: close ticket ───────────────────────────────────────── */
router.post("/admin/support/tickets/:id/close", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { note } = req.body;

    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId));
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    if (note?.trim()) {
      await db.insert(supportMessages).values({
        ticketId,
        senderId: req.session!.userId!,
        message: `[Closing note] ${note.trim()}`,
        isAdmin: true,
      });
    }

    await db
      .update(supportTickets)
      .set({ status: "closed", closedAt: new Date(), closedBy: req.session!.userId!, updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId));

    return res.json({ ok: true, message: "Ticket closed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to close ticket" });
  }
});

/* ── Admin: reopen ticket ──────────────────────────────────────── */
router.post("/admin/support/tickets/:id/reopen", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    await db.update(supportTickets).set({ status: "open", closedAt: null, closedBy: null, updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
    return res.json({ ok: true, message: "Ticket reopened" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to reopen ticket" });
  }
});

export default router;
