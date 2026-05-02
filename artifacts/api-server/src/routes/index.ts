import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scamCheckRouter from "./scam-check";
import linkCheckRouter from "./link-check";
import phoneCheckRouter from "./phone-check";
import chatbotRouter from "./chatbot";
import darkWebCheckRouter from "./dark-web-check";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scamCheckRouter);
router.use(linkCheckRouter);
router.use(phoneCheckRouter);
router.use(chatbotRouter);
router.use(darkWebCheckRouter);

export default router;
