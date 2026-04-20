import { Router, type IRouter } from "express";
import { db, invitationsTable, groupsTable, groupMembersTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createAuditLog } from "../lib/auditLog";
import { sendInviteEmail, sendGroupAddedEmail, sendAdminAddedMemberEmail, sendMemberJoinedNotificationEmail } from "../lib/email";
import crypto from "node:crypto";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getAppBaseUrl(req: import("express").Request): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domain) return `https://${domain}`;
  return `${req.protocol}://${req.hostname}`;
}

router.get("/invitations/:token", async (req, res): Promise<void> => {
  const { token } = req.params;

  const [invite] = await db.select().from(invitationsTable)
    .where(eq(invitationsTable.token, token)).limit(1);

  if (!invite) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  if (invite.status !== "pending") {
    res.status(410).json({ error: "Invitation has already been used or expired" });
    return;
  }

  if (new Date() > invite.expiresAt) {
    await db.update(invitationsTable)
      .set({ status: "expired" })
      .where(eq(invitationsTable.id, invite.id));
    res.status(410).json({ error: "Invitation has expired" });
    return;
  }

  const [group] = await db.select().from(groupsTable)
    .where(eq(groupsTable.id, invite.groupId)).limit(1);

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const [inviter] = await db.select().from(usersTable)
    .where(eq(usersTable.id, invite.invitedBy)).limit(1);

  const [memberCount] = await db.select({ count: sql<number>`count(*)` })
    .from(groupMembersTable).where(eq(groupMembersTable.groupId, group.id));

  res.json({
    token: invite.token,
    email: invite.email,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    group: {
      id: group.id,
      name: group.name,
      currency: group.currency,
      contributionAmount: parseFloat(group.contributionAmount as unknown as string),
      schedule: group.schedule,
      maxMembers: group.maxMembers,
      totalMembers: Number(memberCount?.count ?? 0),
    },
    inviter: inviter ? { name: inviter.name, email: inviter.email } : null,
  });
});

router.post("/invitations/:token/accept", requireAuth, async (req, res): Promise<void> => {
  const { token } = req.params;
  const userId = req.session!.userId!;

  const [invite] = await db.select().from(invitationsTable)
    .where(eq(invitationsTable.token, token)).limit(1);

  if (!invite) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  if (invite.status !== "pending") {
    res.status(410).json({ error: "Invitation has already been used" });
    return;
  }

  if (new Date() > invite.expiresAt) {
    await db.update(invitationsTable)
      .set({ status: "expired" })
      .where(eq(invitationsTable.id, invite.id));
    res.status(410).json({ error: "Invitation has expired" });
    return;
  }

  const [group] = await db.select().from(groupsTable)
    .where(eq(groupsTable.id, invite.groupId)).limit(1);

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const [memberCountResult] = await db.select({ count: sql<number>`count(*)` })
    .from(groupMembersTable).where(eq(groupMembersTable.groupId, invite.groupId));
  const currentCount = Number(memberCountResult?.count ?? 0);

  if (currentCount >= group.maxMembers) {
    res.status(400).json({ error: "Group is now full" });
    return;
  }

  const [existing] = await db.select().from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, invite.groupId), eq(groupMembersTable.userId, userId)))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "You are already a member of this group" });
    return;
  }

  await db.insert(groupMembersTable).values({
    userId,
    groupId: invite.groupId,
    rotationOrder: currentCount,
    hasReceivedPayout: false,
  });

  await db.update(invitationsTable)
    .set({ status: "accepted" })
    .where(eq(invitationsTable.id, invite.id));

  await createAuditLog({
    action: "group.invite_accept",
    performedBy: userId,
    targetType: "group",
    targetId: invite.groupId,
    details: invite.email,
  });

  // Fire-and-forget: notify inviter + other members + welcome the new member
  Promise.resolve().then(async () => {
    try {
      const appBaseUrl = getAppBaseUrl(req);
      const newTotalMembers = currentCount + 1;
      const contributionAmount = parseFloat(group.contributionAmount as unknown as string);

      const [newUser, inviter, otherMemberRecords] = await Promise.all([
        db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1).then(r => r[0]),
        db.select().from(usersTable).where(eq(usersTable.id, invite.invitedBy)).limit(1).then(r => r[0]),
        db.select({ userId: groupMembersTable.userId })
          .from(groupMembersTable)
          .where(and(eq(groupMembersTable.groupId, invite.groupId), sql`${groupMembersTable.userId} != ${userId}`)),
      ]);

      if (!newUser) return;

      // 1. Welcome the new member
      sendGroupAddedEmail({
        email: newUser.email,
        name: newUser.name,
        groupName: group.name,
        inviterName: inviter?.name ?? "A group admin",
        contributionAmount: `${group.currency} ${contributionAmount.toLocaleString()}`,
        schedule: group.schedule,
        appBaseUrl,
      }).catch(err => logger.error({ err }, "invite accept: welcome email failed"));

      // 2. Notify the inviter
      if (inviter && inviter.id !== newUser.id) {
        sendAdminAddedMemberEmail({
          email: inviter.email,
          adminName: inviter.name,
          newMemberName: newUser.name,
          newMemberEmail: newUser.email,
          groupName: group.name,
          totalMembers: newTotalMembers,
          maxMembers: group.maxMembers,
          appBaseUrl,
        }).catch(err => logger.error({ err }, "invite accept: inviter notification failed"));
      }

      // 3. Notify other existing members
      const otherIds = otherMemberRecords.map(m => m.userId).filter(id => id !== invite.invitedBy && id !== newUser.id);
      if (otherIds.length > 0) {
        const { inArray } = await import("drizzle-orm");
        const otherUsers = await db.select().from(usersTable).where(inArray(usersTable.id, otherIds));
        otherUsers.forEach(member => {
          sendMemberJoinedNotificationEmail({
            email: member.email,
            recipientName: member.name,
            newMemberName: newUser.name,
            groupName: group.name,
            totalMembers: newTotalMembers,
            maxMembers: group.maxMembers,
            appBaseUrl,
          }).catch(err => logger.error({ err }, "invite accept: member notification failed"));
        });
      }
    } catch (err) {
      logger.error({ err }, "invite accept: post-accept notifications failed");
    }
  });

  res.json({ success: true, groupId: invite.groupId, groupName: group.name });
});

export async function createGroupInvitation(opts: {
  req: import("express").Request;
  groupId: number;
  email: string;
  invitedBy: number;
  group: typeof groupsTable.$inferSelect;
  inviterName: string;
  totalMembers: number;
}): Promise<{ token: string; inviteUrl: string; emailSent: boolean }> {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(invitationsTable).values({
    token,
    email: opts.email,
    groupId: opts.groupId,
    invitedBy: opts.invitedBy,
    status: "pending",
    expiresAt,
  });

  const appBaseUrl = getAppBaseUrl(opts.req);
  const inviteUrl = `${appBaseUrl}/invite/${token}`;

  const emailSent = await sendInviteEmail({
    inviteToken: token,
    inviteeName: null,
    inviteeEmail: opts.email,
    inviterName: opts.inviterName,
    groupName: opts.group.name,
    groupCurrency: opts.group.currency,
    contributionAmount: parseFloat(opts.group.contributionAmount as unknown as string),
    schedule: opts.group.schedule,
    maxMembers: opts.group.maxMembers,
    totalMembers: opts.totalMembers,
    appBaseUrl,
  });

  return { token, inviteUrl, emailSent };
}

export default router;
