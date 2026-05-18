import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import blockchainRouter from "./blockchain.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(blockchainRouter);

export default router;
