import { Router, type IRouter } from "express";
import childSafetyRouter from "./childSafety";
import healthRouter from "./health";
import privacyPolicyRouter from "./privacyPolicy";
import aiRouter from "./ai";
import premiumRouter from "./premium";

const router: IRouter = Router();

router.use(childSafetyRouter);
router.use(healthRouter);
router.use(privacyPolicyRouter);
router.use(aiRouter);
router.use(premiumRouter);

export default router;
