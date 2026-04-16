import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import organizationsRouter from "./organizations";
import groupsRouter from "./groups";
import contributionsRouter from "./contributions";
import payoutsRouter from "./payouts";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";
import stripeRouter from "./stripe";
import invitationsRouter from "./invitations";
import exitRequestsRouter from "./exitRequests";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(organizationsRouter);
router.use(groupsRouter);
router.use(contributionsRouter);
router.use(payoutsRouter);
router.use(dashboardRouter);
router.use(adminRouter);
router.use(stripeRouter);
router.use(invitationsRouter);
router.use(exitRequestsRouter);

export default router;
