import { Router } from "express";

import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { getCircleClient } from "../lib/circleClient.js";
import { firestoreAdmin } from "../lib/firebaseAdmin.js";
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

router.get("/transactions", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;

    const userSnap = await firestoreAdmin.collection("users").doc(user.uid).get();
    const walletsByChain = (userSnap.data()?.circle?.walletsByChain ?? {}) as Record<
      string,
      { walletId?: string }
    >;

    const walletIds = Array.from(
      new Set(
        Object.values(walletsByChain)
          .map((w) => w.walletId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (walletIds.length === 0) {
      return res.json({ transactions: [] });
    }

    const asString = (value: unknown) => {
      if (typeof value === "string") return value;
      if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
      return undefined;
    };

    const pageSizeRaw = asString(req.query.pageSize);
    const pageAfter = asString(req.query.pageAfter);
    const pageBefore = asString(req.query.pageBefore);
    const blockchain = asString(req.query.blockchain);
    const state = asString(req.query.state);
    const txType = asString(req.query.txType);
    const from = asString(req.query.from);
    const to = asString(req.query.to);
    const order = asString(req.query.order);

    const pageSizeParsed = pageSizeRaw ? Number(pageSizeRaw) : NaN;
    const pageSize = Number.isFinite(pageSizeParsed)
      ? Math.max(1, Math.min(50, Math.floor(pageSizeParsed)))
      : 20;

    const circle = getCircleClient();
    const response = await circle.listTransactions({
      walletIds,
      includeAll: true,
      pageSize,
      ...(pageAfter ? { pageAfter } : {}),
      ...(pageBefore ? { pageBefore } : {}),
      ...(blockchain ? { blockchain } : {}),
      ...(state ? { state } : {}),
      ...(txType ? { txType } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(order ? ({ order } as any) : {}),
    } as any);

    const data = response.data ?? {};
    return res.json({
      transactions: (data as any).transactions ?? [],
      pageAfter: (data as any).pageAfter,
      pageBefore: (data as any).pageBefore,
    });
  } catch (error) {
    console.error("List transactions failed:", error);
    res.status(500).json({ message: (error as Error).message });
  }
});

export default router;
