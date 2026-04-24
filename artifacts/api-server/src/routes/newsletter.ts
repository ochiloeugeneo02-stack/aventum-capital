import { Router } from "express";
import { db } from "@workspace/db";
import { newsletterSubscribers } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sendNewsletterConfirmationEmail } from "../lib/email";
import { getAppBaseUrl } from "../lib/appUrl";

const router = Router();

router.post("/newsletter/subscribe", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email address required" });
    }

    const normalised = email.toLowerCase().trim();

    const [existing] = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, normalised));

    if (existing) {
      if (existing.unsubscribedAt) {
        await db
          .update(newsletterSubscribers)
          .set({ unsubscribedAt: null, confirmed: true })
          .where(eq(newsletterSubscribers.email, normalised));
      }
      return res.json({ ok: true, alreadySubscribed: true });
    }

    await db.insert(newsletterSubscribers).values({
      email: normalised,
      source: "landing_page",
      confirmed: true,
    });

    await sendNewsletterConfirmationEmail({ email: normalised, appBaseUrl: getAppBaseUrl(req) });

    return res.status(201).json({ ok: true, alreadySubscribed: false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to subscribe" });
  }
});

export default router;
