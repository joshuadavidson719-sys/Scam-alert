import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scamCheckRouter from "./scam-check";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scamCheckRouter);

export default router;
