import { Router } from "express";

import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import {
  provisionCircleWalletsForUser,
  recomputeUnifiedUsdcBalance,
} from "../services/circle.service.js";

const router = Router();

router.post("/provision", requireAuth, async (req, res) => {
  try {
    console.log("Provisioning circle wallets");
    const { user } = req as AuthenticatedRequest;
    const circle = await provisionCircleWalletsForUser(user.uid);
    const balance = await recomputeUnifiedUsdcBalance(user.uid);
    res.json({ circle, balance });
  } catch (error) {
    console.error("Provision failed:", error);
    res.status(500).json({ message: (error as Error).message });
  }
});

router.post("/recompute-balance", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const balance = await recomputeUnifiedUsdcBalance(user.uid);
    res.json({ balance });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
});

export default router;
