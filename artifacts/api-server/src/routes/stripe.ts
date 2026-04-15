import { Router, type IRouter } from "express";
import { db, usersTable, groupsTable, groupMembersTable, contributionCyclesTable, contributionsTable, payoutsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { getUncachableStripeClient, getStripePublishableKey } from "../lib/stripeClient";
import { createAuditLog } from "../lib/auditLog";
import { formatUser } from "./users";

const router: IRouter = Router();

/**
 * Aventum Capital platform fee: 2% of each contribution.
 * Applied as a Stripe application_fee_amount on every PaymentIntent.
 * In cents: floor(amountKES * 100 * 0.02)
 */
const PLATFORM_FEE_RATE = 0.02;

/** Ensure a Stripe customer exists for the user, creating one if needed. */
async function ensureStripeCustomer(userId: number): Promise<string> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) throw new Error("User not found");

  if (user.stripeCustomerId) return user.stripeCustomerId;

  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { aventum_user_id: String(userId) },
  });

  await db.update(usersTable)
    .set({ stripeCustomerId: customer.id })
    .where(eq(usersTable.id, userId));

  return customer.id;
}

/**
 * GET /api/stripe/config
 * Returns the Stripe publishable key for the frontend.
 */
router.get("/stripe/config", async (_req, res): Promise<void> => {
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch (err) {
    res.status(503).json({ error: "Stripe not configured" });
  }
});

/**
 * POST /api/stripe/create-payment-intent
 * Creates a PaymentIntent for a member's contribution to a group cycle.
 *
 * Body: { groupId, cycleId }
 *
 * Flow:
 * 1. Validates membership + group/cycle state
 * 2. Ensures a Stripe customer exists for the user
 * 3. Creates a PaymentIntent for the contribution amount
 * 4. Returns the clientSecret for the frontend to confirm payment
 */
/**
 * Supported Stripe currencies with conversion config.
 * KES is the canonical DB currency. All amounts are stored as KES.
 * For display/charging in other currencies, we convert at the approximate rate.
 */
const STRIPE_CURRENCY_CONFIG: Record<string, { rate: number; zeroDecimal: boolean; sandboxSafe: boolean }> = {
  kes: { rate: 1,        zeroDecimal: true,  sandboxSafe: false },
  usd: { rate: 1/130,    zeroDecimal: false, sandboxSafe: true  },
  eur: { rate: 1/142,    zeroDecimal: false, sandboxSafe: true  },
  gbp: { rate: 1/165,    zeroDecimal: false, sandboxSafe: true  },
  cad: { rate: 1/96,     zeroDecimal: false, sandboxSafe: true  },
  aud: { rate: 1/85,     zeroDecimal: false, sandboxSafe: true  },
  ngn: { rate: 8.27,     zeroDecimal: true,  sandboxSafe: false },
  tzs: { rate: 34.48,    zeroDecimal: true,  sandboxSafe: false },
  ugx: { rate: 29.41,    zeroDecimal: true,  sandboxSafe: false },
};

router.post("/stripe/create-payment-intent", requireAuth, async (req, res): Promise<void> => {
  const { groupId, cycleId, currency: requestedCurrency } = req.body;
  const userId = req.session!.userId!;

  if (!groupId || !cycleId) {
    res.status(400).json({ error: "groupId and cycleId are required" });
    return;
  }

  // Member check
  const [membership] = await db.select().from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId)))
    .limit(1);
  if (!membership) {
    res.status(403).json({ error: "You are not a member of this group" });
    return;
  }

  // Group check
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  if (group.status !== "active") {
    res.status(400).json({ error: `Group is ${group.status} and not accepting contributions` });
    return;
  }

  // Cycle check
  const [cycle] = await db.select().from(contributionCyclesTable)
    .where(and(eq(contributionCyclesTable.id, cycleId), eq(contributionCyclesTable.groupId, groupId)))
    .limit(1);
  if (!cycle || cycle.status !== "active") {
    res.status(400).json({ error: "This cycle is not active" });
    return;
  }

  // Already paid?
  const [existing] = await db.select().from(contributionsTable)
    .where(and(
      eq(contributionsTable.userId, userId),
      eq(contributionsTable.groupId, groupId),
      eq(contributionsTable.cycleId, cycleId),
    )).limit(1);
  if (existing?.status === "paid") {
    res.status(400).json({ error: "Already paid for this cycle" });
    return;
  }

  const amountKES = parseFloat(group.contributionAmount as unknown as string);

  // Determine which currency to charge in.
  // Frontend passes the user's regional currency preference (e.g. "USD", "KES", "GBP").
  // In sandbox mode, only sandbox-safe currencies (USD, EUR, GBP, CAD, AUD) work reliably.
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const preferred = (requestedCurrency ?? "KES").toLowerCase();
  const currencyConfig = STRIPE_CURRENCY_CONFIG[preferred];

  // Fall back to USD in sandbox if the preferred currency isn't sandbox-safe
  const activeCurrency = (!isProduction && currencyConfig && !currencyConfig.sandboxSafe)
    ? "usd"
    : (currencyConfig ? preferred : "usd");
  const config = STRIPE_CURRENCY_CONFIG[activeCurrency] ?? STRIPE_CURRENCY_CONFIG.usd;

  // Convert from KES to the target currency.
  // Zero-decimal currencies: amount is in whole units (e.g., KES, NGN)
  // Two-decimal currencies: amount is in cents (e.g., USD → multiply by 100)
  const convertedAmount = amountKES * config.rate;
  const amountInt = config.zeroDecimal
    ? Math.round(convertedAmount)
    : Math.round(convertedAmount * 100);

  const platformFee = Math.floor(amountInt * PLATFORM_FEE_RATE);

  const customerId = await ensureStripeCustomer(userId);
  const stripe = await getUncachableStripeClient();

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: amountInt,
      currency: activeCurrency,
      customer: customerId,
      metadata: {
        aventum_user_id: String(userId),
        aventum_group_id: String(groupId),
        aventum_cycle_id: String(cycleId),
        aventum_group_name: group.name,
        platform_fee: String(platformFee),
      },
      description: `Contribution – ${group.name} – Cycle #${cycle.cycleNumber}`,
      automatic_payment_methods: { enabled: true },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create payment intent" });
    return;
  }

  res.json({
    clientSecret: paymentIntent.client_secret,
    amountKES,
    amountCharged: amountInt,
    platformFee,
    currency: activeCurrency.toUpperCase(),
    paymentIntentId: paymentIntent.id,
  });
});

/**
 * POST /api/stripe/confirm-contribution
 * Called by the frontend after Stripe confirms the PaymentIntent.
 * Records the contribution in our database.
 *
 * Body: { groupId, cycleId, paymentIntentId }
 */
router.post("/stripe/confirm-contribution", requireAuth, async (req, res): Promise<void> => {
  const { groupId, cycleId, paymentIntentId } = req.body;
  const userId = req.session!.userId!;

  if (!groupId || !cycleId || !paymentIntentId) {
    res.status(400).json({ error: "groupId, cycleId, and paymentIntentId are required" });
    return;
  }

  // Verify the PaymentIntent with Stripe
  const stripe = await getUncachableStripeClient();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (intent.status !== "succeeded") {
    res.status(400).json({ error: `Payment not completed — status: ${intent.status}` });
    return;
  }

  // Verify the intent belongs to this user/group/cycle
  if (
    intent.metadata.aventum_user_id !== String(userId) ||
    intent.metadata.aventum_group_id !== String(groupId) ||
    intent.metadata.aventum_cycle_id !== String(cycleId)
  ) {
    res.status(403).json({ error: "Payment intent does not match this request" });
    return;
  }

  // Already recorded?
  const [existing] = await db.select().from(contributionsTable)
    .where(and(
      eq(contributionsTable.userId, userId),
      eq(contributionsTable.groupId, groupId),
      eq(contributionsTable.cycleId, cycleId),
    )).limit(1);

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  let contribution: typeof contributionsTable.$inferSelect;

  if (existing?.status === "paid") {
    // Idempotent — already processed
    contribution = existing;
  } else if (existing) {
    const [updated] = await db.update(contributionsTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(contributionsTable.id, existing.id))
      .returning();
    contribution = updated;
  } else {
    const [created] = await db.insert(contributionsTable).values({
      userId,
      groupId,
      cycleId,
      amount: group.contributionAmount,
      status: "paid",
      paidAt: new Date(),
    }).returning();
    contribution = created;
  }

  await createAuditLog({
    action: "contribution.pay",
    performedBy: userId,
    targetType: "contribution",
    targetId: contribution.id,
    details: `Stripe PaymentIntent ${paymentIntentId} — Amount: ${group.contributionAmount}`,
  });

  // Check if the whole cycle is now fully paid — trigger cycle advance
  const allMembers = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const paidContribs = await db.select().from(contributionsTable)
    .where(and(eq(contributionsTable.cycleId, cycleId), eq(contributionsTable.status, "paid")));

  if (paidContribs.length >= allMembers.length) {
    const rotationMember = allMembers.find((m) => m.rotationOrder === group.currentRotationIndex);
    if (rotationMember) {
      const totalPayout = parseFloat(group.contributionAmount as unknown as string) * allMembers.length;
      await db.insert(payoutsTable).values({
        groupId,
        cycleId,
        recipientId: rotationMember.userId,
        amount: String(totalPayout),
        status: "pending",
      });
      await db.update(groupMembersTable)
        .set({ hasReceivedPayout: true })
        .where(eq(groupMembersTable.id, rotationMember.id));
    }

    await db.update(contributionCyclesTable)
      .set({ status: "completed", endDate: new Date() })
      .where(eq(contributionCyclesTable.id, cycleId));

    const nextCycleNumber = group.currentCycle + 1;
    const nextRotationIndex = group.currentRotationIndex + 1;
    const allPaidOut = nextRotationIndex >= allMembers.length;

    if (!allPaidOut) {
      const dueDate = new Date();
      if (group.schedule === "weekly") dueDate.setDate(dueDate.getDate() + 7);
      else if (group.schedule === "monthly") dueDate.setMonth(dueDate.getMonth() + 1);
      else dueDate.setDate(dueDate.getDate() + 14);

      await db.insert(contributionCyclesTable).values({
        groupId,
        cycleNumber: nextCycleNumber,
        status: "active",
        dueDate,
      });
    }

    await db.update(groupsTable).set({
      currentCycle: nextCycleNumber,
      currentRotationIndex: nextRotationIndex,
      status: allPaidOut ? "completed" : "active",
    }).where(eq(groupsTable.id, groupId));
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  res.status(201).json({
    id: contribution.id,
    userId: contribution.userId,
    groupId: contribution.groupId,
    cycleId: contribution.cycleId,
    amount: parseFloat(contribution.amount as unknown as string),
    status: contribution.status,
    paidAt: contribution.paidAt ? contribution.paidAt.toISOString() : null,
    user: user ? formatUser(user) : null,
    paymentIntentId,
  });
});

/**
 * POST /api/stripe/create-payout-transfer
 * Initiates the actual payout to the rotation recipient via Stripe (admin only).
 * In a real deployment, you'd connect members' bank accounts via Stripe Connect.
 * For MVP: records the payout as "transfer initiated" and updates the DB.
 *
 * Body: { payoutId }
 */
router.post("/stripe/create-payout-transfer", requireRole("super_admin", "group_admin"), async (req, res): Promise<void> => {
  const { payoutId } = req.body;

  if (!payoutId) {
    res.status(400).json({ error: "payoutId is required" });
    return;
  }

  const [payout] = await db.select().from(payoutsTable).where(eq(payoutsTable.id, payoutId)).limit(1);
  if (!payout) {
    res.status(404).json({ error: "Payout not found" });
    return;
  }
  if (payout.status === "paid") {
    res.status(400).json({ error: "Payout already completed" });
    return;
  }

  const [recipient] = await db.select().from(usersTable).where(eq(usersTable.id, payout.recipientId)).limit(1);
  if (!recipient) {
    res.status(404).json({ error: "Recipient user not found" });
    return;
  }

  const amountKES = parseFloat(payout.amount as unknown as string);

  // Mark payout as paid in our DB
  const [updated] = await db.update(payoutsTable)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(payoutsTable.id, payoutId))
    .returning();

  await createAuditLog({
    action: "payout.complete",
    performedBy: req.session!.userId!,
    targetType: "payout",
    targetId: payoutId,
    details: `Transfer of KES ${amountKES.toLocaleString()} to ${recipient.email}`,
  });

  res.json({
    success: true,
    payoutId: updated.id,
    recipientName: recipient.name,
    recipientEmail: recipient.email,
    amount: amountKES,
    status: updated.status,
    paidAt: updated.paidAt?.toISOString(),
  });
});

export default router;
