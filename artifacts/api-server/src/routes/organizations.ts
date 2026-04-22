import { Router, type IRouter } from "express";
import { db, organizationsTable, usersTable, groupsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { CreateOrganizationBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function buildOrg(org: typeof organizationsTable.$inferSelect, includeGroups = false) {
  const [memberCount, groupCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.organizationId, org.id)),
    db.select({ count: sql<number>`count(*)` }).from(groupsTable).where(eq(groupsTable.organizationId, org.id)),
  ]);

  const base = {
    id: org.id,
    name: org.name,
    adminId: org.adminId,
    plan: org.plan,
    status: org.status,
    industry: org.industry,
    website: org.website,
    billingEmail: org.billingEmail,
    employeeCount: org.employeeCount,
    logoUrl: org.logoUrl,
    accountManager: org.accountManager,
    contractStart: org.contractStart ? org.contractStart.toISOString() : null,
    contractEnd: org.contractEnd ? org.contractEnd.toISOString() : null,
    notes: org.notes,
    totalMembers: Number(memberCount[0]?.count ?? 0),
    totalGroups: Number(groupCount[0]?.count ?? 0),
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };

  if (!includeGroups) return base;

  const groups = await db.select().from(groupsTable).where(eq(groupsTable.organizationId, org.id));

  return {
    ...base,
    totalContributed: 0,
    totalPaidOut: 0,
    groups: groups.map(formatGroup),
  };
}

function formatGroup(g: typeof groupsTable.$inferSelect) {
  return {
    id: g.id,
    name: g.name,
    adminId: g.adminId,
    organizationId: g.organizationId ?? null,
    contributionAmount: parseFloat(g.contributionAmount as unknown as string),
    schedule: g.schedule,
    maxMembers: g.maxMembers,
    currentCycle: g.currentCycle,
    currentRotationIndex: g.currentRotationIndex,
    status: g.status,
    totalMembers: 0,
    paidCount: 0,
    createdAt: g.createdAt.toISOString(),
  };
}

router.get("/organizations", requireAuth, asyncHandler(async (_req, res): Promise<void> => {
  const orgs = await db.select().from(organizationsTable);
  const result = await Promise.all(orgs.map((o) => buildOrg(o)));
  res.json(result);
}));

router.post("/organizations", requireAuth, asyncHandler(async (req, res): Promise<void> => {
  const parsed = CreateOrganizationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [org] = await db.insert(organizationsTable).values({
    name: parsed.data.name,
    adminId: req.session!.userId!,
  }).returning();

  res.status(201).json(await buildOrg(org));
}));

router.get("/organizations/:orgId", requireAuth, asyncHandler(async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);

  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  res.json(await buildOrg(org, true));
}));

router.get("/admin/organizations", requireAuth, requireRole("super_admin"), asyncHandler(async (_req, res): Promise<void> => {
  const orgs = await db.select().from(organizationsTable).orderBy(organizationsTable.createdAt);
  const result = await Promise.all(orgs.map((o) => buildOrg(o)));
  res.json(result);
}));

router.patch("/admin/organizations/:orgId", requireAuth, requireRole("super_admin"), asyncHandler(async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const orgId = parseInt(raw, 10);

  const [existing] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  const allowed = ["name", "plan", "status", "industry", "website", "billingEmail",
                   "employeeCount", "logoUrl", "accountManager", "notes", "contractStart", "contractEnd"];
  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (key in req.body) {
      if ((key === "contractStart" || key === "contractEnd") && req.body[key]) {
        updates[key] = new Date(req.body[key]);
      } else {
        updates[key] = req.body[key] ?? null;
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [updated] = await db.update(organizationsTable)
    .set(updates)
    .where(eq(organizationsTable.id, orgId))
    .returning();

  res.json(await buildOrg(updated));
}));

export default router;
