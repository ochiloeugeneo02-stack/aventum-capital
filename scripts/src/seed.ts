import { db, usersTable, organizationsTable, groupsTable, groupMembersTable, contributionCyclesTable, contributionsTable, payoutsTable, auditLogsTable } from "@workspace/db";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  await db.delete(auditLogsTable);
  await db.delete(payoutsTable);
  await db.delete(contributionsTable);
  await db.delete(contributionCyclesTable);
  await db.delete(groupMembersTable);
  await db.delete(groupsTable);
  await db.delete(organizationsTable);
  await db.delete(usersTable);

  const hashPw = (pw: string) => bcrypt.hashSync(pw, 12);

  const [superAdmin] = await db.insert(usersTable).values({
    name: "Super Admin",
    email: "admin@aventum.co",
    passwordHash: hashPw("admin123"),
    role: "super_admin",
    isActive: true,
  }).returning();

  const [groupAdmin] = await db.insert(usersTable).values({
    name: "Grace Wanjiku",
    email: "grace@aventum.co",
    passwordHash: hashPw("grace123"),
    role: "group_admin",
    isActive: true,
  }).returning();

  const members = await db.insert(usersTable).values([
    { name: "Amina Hassan", email: "amina@aventum.co", passwordHash: hashPw("member123"), role: "member", isActive: true },
    { name: "David Ochieng", email: "david@aventum.co", passwordHash: hashPw("member123"), role: "member", isActive: true },
    { name: "Fatuma Mwangi", email: "fatuma@aventum.co", passwordHash: hashPw("member123"), role: "member", isActive: true },
    { name: "James Kamau", email: "james@aventum.co", passwordHash: hashPw("member123"), role: "member", isActive: true },
  ]).returning();

  const [org] = await db.insert(organizationsTable).values({
    name: "Aventum Savings Network",
    adminId: superAdmin.id,
  }).returning();

  await db.update(usersTable).set({ organizationId: org.id });

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const [group] = await db.insert(groupsTable).values({
    name: "Nairobi Savings Circle",
    adminId: groupAdmin.id,
    organizationId: org.id,
    contributionAmount: "5000",
    schedule: "bi-weekly",
    maxMembers: 5,
    currentCycle: 1,
    currentRotationIndex: 0,
    status: "active",
  }).returning();

  const allMembers = [groupAdmin, ...members];
  await db.insert(groupMembersTable).values(
    allMembers.map((u, i) => ({
      userId: u.id,
      groupId: group.id,
      rotationOrder: i,
      hasReceivedPayout: false,
    }))
  );

  const [cycle] = await db.insert(contributionCyclesTable).values({
    groupId: group.id,
    cycleNumber: 1,
    status: "active",
    dueDate,
  }).returning();

  await db.insert(contributionsTable).values([
    { userId: groupAdmin.id, groupId: group.id, cycleId: cycle.id, amount: "5000", status: "paid", paidAt: new Date() },
    { userId: members[0].id, groupId: group.id, cycleId: cycle.id, amount: "5000", status: "paid", paidAt: new Date() },
    { userId: members[1].id, groupId: group.id, cycleId: cycle.id, amount: "5000", status: "pending" },
    { userId: members[2].id, groupId: group.id, cycleId: cycle.id, amount: "5000", status: "pending" },
    { userId: members[3].id, groupId: group.id, cycleId: cycle.id, amount: "5000", status: "pending" },
  ]);

  await db.insert(auditLogsTable).values([
    { action: "user.register", performedBy: superAdmin.id, targetType: "user", targetId: superAdmin.id },
    { action: "group.create", performedBy: groupAdmin.id, targetType: "group", targetId: group.id },
    { action: "contribution.pay", performedBy: groupAdmin.id, targetType: "contribution", details: "Amount: 5000" },
    { action: "contribution.pay", performedBy: members[0].id, targetType: "contribution", details: "Amount: 5000" },
  ]);

  console.log("\n=== SEED COMPLETE ===");
  console.log("\nDemo Accounts:");
  console.log("  Super Admin: admin@aventum.co / admin123");
  console.log("  Group Admin: grace@aventum.co / grace123");
  console.log("  Member 1:    amina@aventum.co / member123");
  console.log("  Member 2:    david@aventum.co / member123");
  console.log("  Member 3:    fatuma@aventum.co / member123");
  console.log("  Member 4:    james@aventum.co / member123");
  console.log("\nGroup: Nairobi Savings Circle (2/5 paid in cycle 1)");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
}).finally(() => process.exit(0));
