import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

// Prevent unhandled rejections and uncaught exceptions from crashing the server
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection — server kept alive");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — server kept alive");
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureAppSchema() {
  const client = await pool.connect();
  try {
    logger.info("Running migrations");

    // Add missing columns to existing tables
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username text UNIQUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS location text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_marketing boolean NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS motivation text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_expiry timestamp with time zone;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text;
    `);

    // Session table for connect-pg-simple
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      );
      CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON user_sessions ("expire");
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS group_messages (
        id serial PRIMARY KEY,
        group_id integer NOT NULL,
        user_id integer NOT NULL,
        content text NOT NULL,
        message_type text NOT NULL DEFAULT 'text',
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS support_tickets (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category varchar(50) NOT NULL DEFAULT 'general',
        group_id integer REFERENCES groups(id) ON DELETE SET NULL,
        subject varchar(255) NOT NULL,
        status varchar(50) NOT NULL DEFAULT 'open',
        priority varchar(20) NOT NULL DEFAULT 'normal',
        closed_at timestamp,
        closed_by integer REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS support_messages (
        id serial PRIMARY KEY,
        ticket_id integer NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        sender_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message text NOT NULL,
        is_admin boolean NOT NULL DEFAULT false,
        read_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS turn_swap_requests (
        id serial PRIMARY KEY,
        group_id integer NOT NULL,
        requester_id integer NOT NULL,
        target_member_id integer NOT NULL,
        reason text,
        status text NOT NULL DEFAULT 'pending',
        admin_note text,
        group_admin_id integer,
        group_admin_decided_at timestamp with time zone,
        super_admin_decided_at timestamp with time zone,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS group_delete_requests (
        id serial PRIMARY KEY,
        group_id integer NOT NULL,
        requested_by integer NOT NULL,
        reason text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        reviewed_by integer,
        review_note text,
        disbursement_note text,
        requested_at timestamp with time zone NOT NULL DEFAULT now(),
        reviewed_at timestamp with time zone
      );

      CREATE TABLE IF NOT EXISTS app_maintenance_events (
        key text PRIMARY KEY,
        applied_at timestamp with time zone NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS direct_messages (
        id serial PRIMARY KEY,
        from_user_id integer NOT NULL,
        to_user_id integer NOT NULL,
        content text NOT NULL,
        read_at timestamp with time zone,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
    `);
    // Ensure demo credentials are always usable — safe to run on every start.
    // admin@aventum.co        → Aventum2024!
    // grace@aventum.co        → grace123
    // amina / david / fatuma / james → member123
    const adminHash  = "$2b$12$WwcWYrDPVb4lAJTztWo97.TPJole7vGNvHIr9mFdNIOdfYNqEGgZ.";
    const graceHash  = "$2b$12$lrA2qDocrvec65hEVzTej.m04rY2.WmLE3a1Z0iQgjodjeSsr07Eq";
    const memberHash = "$2b$12$aDjjXMeBRQHZupaKCBNvFu1RYZcYXroWqGUeLzG.pLYqIooSHjrMq";
    const theWaveHash = "$2b$12$Abis.RFiWrBTN9lZUgBDH.oVO7Cong8zQWu0HCbf6Y4yntk2mldsG";

    await client.query(
      `UPDATE users SET password_hash = $1, role = 'super_admin' WHERE email = 'admin@aventum.co'`,
      [adminHash]
    );
    await client.query(
      `UPDATE users SET password_hash = $1 WHERE email = 'grace@aventum.co'`,
      [graceHash]
    );
    await client.query(
      `UPDATE users SET password_hash = $1 WHERE email IN ('amina@aventum.co','david@aventum.co','fatuma@aventum.co','james@aventum.co')`,
      [memberHash]
    );
    await client.query(
      `INSERT INTO users (name, email, username, password_hash, role, is_active, email_marketing)
       VALUES ('oliver', 'thewave.grpevents@gmail.com', 'thewave', $1, 'group_admin', true, false)
       ON CONFLICT (email) DO NOTHING`,
      [theWaveHash]
    );
    // eoo.admin@aventumcapital.com → Aventum@2024 (super_admin)
    const eooHash = "$2b$10$4O4B19RV.Lp.o0OTf4Xn9uQGLaGYV/z7PMGP4p63.amEHAhhgwLSG";
    await client.query(
      `UPDATE users SET password_hash = $1, role = 'super_admin' WHERE email = 'eoo.admin@aventumcapital.com'`,
      [eooHash]
    );

    const theWaveRemoval = await client.query(
      `WITH marker AS (
         INSERT INTO app_maintenance_events (key)
         VALUES ('remove-thewave-from-groups-2026-04-21')
         ON CONFLICT (key) DO NOTHING
         RETURNING key
       )
       DELETE FROM group_members gm
       USING users u
       WHERE EXISTS (SELECT 1 FROM marker)
         AND gm.user_id = u.id
         AND lower(u.email) = 'thewave.grpevents@gmail.com'
       RETURNING gm.id, gm.group_id`
    );
    if (theWaveRemoval.rowCount > 0) {
      logger.info({ removedMemberships: theWaveRemoval.rowCount }, "Removed TheWave from groups for invite retest");
    }

    logger.info("Migrations complete");
  } catch (err) {
    logger.error({ err }, "Schema migration failed — continuing");
  } finally {
    client.release();
  }
}

async function initStripe() {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      logger.warn("DATABASE_URL not set — skipping Stripe init");
      return;
    }

    const { runMigrations } = await import("stripe-replit-sync");
    logger.info("Initializing Stripe schema...");
    await runMigrations({
      databaseUrl,
      logger: {
        info: (msg: string) => logger.info(msg),
        error: (err: any, msg: string) => logger.error({ err }, msg),
        warn: (msg: string) => logger.warn(msg),
      },
    });
    logger.info("Stripe schema ready");

    const { getStripeSync } = await import("./lib/stripeClient");
    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    logger.info("Stripe webhook configured");

    // Backfill runs in the background — don't block startup
    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe data backfill complete"))
      .catch((err: Error) => logger.error({ err }, "Stripe backfill error"));
  } catch (err) {
    logger.error({ err }, "Stripe initialization failed — continuing without Stripe");
  }
}

await ensureAppSchema();
await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
