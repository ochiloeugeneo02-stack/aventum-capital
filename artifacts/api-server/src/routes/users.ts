import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { UpdateUserBody } from "@workspace/api-zod";

const router: IRouter = Router();

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username ?? null,
    role: u.role,
    organizationId: u.organizationId ?? null,
    phoneNumber: u.phoneNumber ?? null,
    location: u.location ?? null,
    emailMarketing: u.emailMarketing,
    motivation: u.motivation ?? null,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/users", requireRole("super_admin"), async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);
  const search = req.query.search ? String(req.query.search) : undefined;
  const offset = (page - 1) * limit;

  let query = db.select().from(usersTable);

  if (search) {
    query = query.where(
      or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.email, `%${search}%`))
    ) as typeof query;
  }

  const [users, countResult] = await Promise.all([
    query.limit(limit).offset(offset).orderBy(usersTable.createdAt),
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
  ]);

  res.json({
    users: users.map(formatUser),
    total: Number(countResult[0]?.count ?? 0),
    page,
    limit,
  });
});

router.get("/users/:userId", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(formatUser(user));
});

router.put("/users/:userId", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(raw, 10);

  if (req.session?.userId !== userId && req.session?.userRole !== "super_admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.username !== undefined) updateData.username = parsed.data.username;
  if (parsed.data.phoneNumber !== undefined) updateData.phoneNumber = parsed.data.phoneNumber;
  if (parsed.data.location !== undefined) updateData.location = parsed.data.location;
  if (parsed.data.emailMarketing !== undefined) updateData.emailMarketing = parsed.data.emailMarketing;
  if (parsed.data.notificationEmail !== undefined) updateData.notificationEmail = parsed.data.notificationEmail;
  if (parsed.data.notificationSms !== undefined) updateData.notificationSms = parsed.data.notificationSms;

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, userId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(formatUser(user));
});

export { formatUser };
export default router;
