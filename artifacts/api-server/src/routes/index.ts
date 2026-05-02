import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scamCheckRouter from "./scam-check";
import linkCheckRouter from "./link-check";
import phoneCheckRouter from "./phone-check";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scamCheckRouter);
router.use(linkCheckRouter);
router.use(phoneCheckRouter);

export default router;
