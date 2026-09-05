import { Router, type IRouter } from "express";
import childSafetyRouter from "./childSafety";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(childSafetyRouter);
router.use(healthRouter);

export default router;
