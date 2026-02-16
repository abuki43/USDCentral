import { Router } from "express";

import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validate.js";
import {
  depositSchema,
  quoteSchema,
  withdrawSchema,
} from "../schemas/liquidity.schema.js";
import {
  depositUsdcToCurve,
  getCurvePositionForUser,
  quoteUsdcCurveDeposit,
  withdrawUsdcFromCurve,
} from "../services/liquidity.service.js";

const router = Router();

router.post("/quote", requireAuth, validateBody(quoteSchema), async (req, res, next) => {
  try {
    const { amount } = req.validatedBody as { amount: string };

    const quote = await quoteUsdcCurveDeposit({ amount });

    return res.json({ quote });
  } catch (error) {
    return next(error);
  }
});

router.post("/deposit", requireAuth, validateBody(depositSchema), async (req, res, next) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { amount } = req.validatedBody as { amount: string };

    const result = await depositUsdcToCurve({ uid: user.uid, amount });

    return res.json({ result });
  } catch (error) {
    return next(error);
  }
});

router.get("/position", requireAuth, async (req, res, next) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const position = await getCurvePositionForUser(user.uid);
    return res.json({ position });
  } catch (error) {
    return next(error);
  }
});

router.post("/withdraw", requireAuth, validateBody(withdrawSchema), async (req, res, next) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { amount } = req.validatedBody as { amount: string };
    const result = await withdrawUsdcFromCurve({ uid: user.uid, amount });
    return res.json({ result });
  } catch (error) {
    return next(error);
  }
});

export default router;
