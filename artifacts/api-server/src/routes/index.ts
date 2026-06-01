import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scamCheckRouter from "./scam-check";
import linkCheckRouter from "./link-check";
import phoneCheckRouter from "./phone-check";
import chatbotRouter from "./chatbot";
import darkWebCheckRouter from "./dark-web-check";
import swiftopRouter from "./swiftop";
import githubTokenRouter from "./github-token";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scamCheckRouter);
router.use(linkCheckRouter);
router.use(phoneCheckRouter);
router.use(chatbotRouter);
router.use(darkWebCheckRouter);
router.use(swiftopRouter);
router.use(githubTokenRouter);

export default router;
