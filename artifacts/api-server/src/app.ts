import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./lib/webhookHandlers";

const app: Express = express();

// Trust Replit's reverse proxy so Express sees HTTPS requests correctly.
// Required for session cookies with `secure: true` to be set properly.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));

// IMPORTANT: Stripe webhook must be registered BEFORE express.json()
// so it receives the raw Buffer needed for signature verification.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: any) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

// Body parsers AFTER the webhook route
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const PgSession = connectPgSimple(session);
const pgStore = new PgSession({
  conString: process.env.DATABASE_URL,
  tableName: "user_sessions",
  createTableIfMissing: true,
  pruneSessionInterval: 60 * 15, // prune expired sessions every 15 min
});

app.use(session({
  store: pgStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  },
}));

app.use("/api", router);

// Global error handler — catches any error passed via next(err) or thrown in asyncHandler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status ?? err.statusCode ?? 500;
  const message = status < 500 ? err.message : "An unexpected error occurred. Please try again.";
  logger.error({ err, url: req.url, method: req.method }, "Unhandled route error");
  if (!res.headersSent) {
    res.status(status).json({ error: message });
  }
});

export default app;
