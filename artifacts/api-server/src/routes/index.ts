import { Router, type IRouter } from "express";
import childSafetyRouter from "./childSafety";
import healthRouter from "./health";
import privacyPolicyRouter from "./privacyPolicy";
import aiRouter from "./ai";
import premiumRouter from "./premium";
import institutionsRouter from "./institutions";
import institutionPasskeysRouter from "./institutionPasskeys";

const router: IRouter = Router();

router.use(childSafetyRouter);
router.use(healthRouter);
router.use(privacyPolicyRouter);
router.use(aiRouter);
router.use(premiumRouter);
router.use(institutionsRouter);
router.use(institutionPasskeysRouter);

export default router;
