import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/dm/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const result = await db.execute(sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.avatar,
      dm.content AS last_message,
      dm.created_at AS last_message_at,
      dm.from_user_id AS last_from_id,
      (
        SELECT COUNT(*) FROM direct_messages
        WHERE to_user_id = ${userId}
          AND from_user_id = u.id
          AND read_at IS NULL
      ) AS unread_count
    FROM users u
    INNER JOIN LATERAL (
      SELECT content, created_at, from_user_id
      FROM direct_messages
      WHERE (from_user_id = ${userId} AND to_user_id = u.id)
         OR (from_user_id = u.id AND to_user_id = ${userId})
      ORDER BY created_at DESC
      LIMIT 1
    ) dm ON true
    WHERE u.id != ${userId}
    ORDER BY dm.created_at DESC
  `);

  res.json(result.rows);
});

router.get("/dm/:otherUserId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const otherUserId = parseInt(req.params.otherUserId);
  if (isNaN(otherUserId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const [otherUser] = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    avatar: sql<string | null>`${usersTable}.avatar`,
  }).from(usersTable).where(sql`${usersTable.id} = ${otherUserId}`).limit(1);

  if (!otherUser) { res.status(404).json({ error: "User not found" }); return; }

  const messages = await db.execute(sql`
    SELECT
      dm.id,
      dm.from_user_id,
      dm.to_user_id,
      dm.content,
      dm.read_at,
      dm.created_at,
      u.name AS from_name,
      u.avatar AS from_avatar
    FROM direct_messages dm
    INNER JOIN users u ON u.id = dm.from_user_id
    WHERE (dm.from_user_id = ${userId} AND dm.to_user_id = ${otherUserId})
       OR (dm.from_user_id = ${otherUserId} AND dm.to_user_id = ${userId})
    ORDER BY dm.created_at ASC
  `);

  await db.execute(sql`
    UPDATE direct_messages
    SET read_at = now()
    WHERE from_user_id = ${otherUserId}
      AND to_user_id = ${userId}
      AND read_at IS NULL
  `);

  res.json({ user: otherUser, messages: messages.rows });
});

router.post("/dm/:otherUserId", requireAuth, async (req, res): Promise<void> => {
  const fromUserId = req.session.userId!;
  const toUserId = parseInt(req.params.otherUserId);
  if (isNaN(toUserId)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  if (toUserId === fromUserId) { res.status(400).json({ error: "Cannot message yourself" }); return; }

  const { content } = req.body;
  if (!content?.trim()) { res.status(400).json({ error: "Message cannot be empty" }); return; }

  const result = await db.execute(sql`
    INSERT INTO direct_messages (from_user_id, to_user_id, content)
    VALUES (${fromUserId}, ${toUserId}, ${content.trim()})
    RETURNING id, from_user_id, to_user_id, content, created_at
  `);

  logger.info({ fromUserId, toUserId }, "Direct message sent");
  res.json(result.rows[0]);
});

router.get("/dm/unread-count", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const result = await db.execute(sql`
    SELECT COUNT(*) AS count
    FROM direct_messages
    WHERE to_user_id = ${userId} AND read_at IS NULL
  `);

  res.json({ count: Number((result.rows[0] as any)?.count ?? 0) });
});

export default router;
