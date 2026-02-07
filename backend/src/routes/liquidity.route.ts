import { Router } from "express";

import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
// import { createPositionSchema, quoteSchema, uidQuerySchema } from "../schemas/liquidity.schema.js";
// import {
//   collectPositionFees,
//   createUsdcPosition,
//   getPositionStatus,
//   listPositionsStatusForUser,
//   listPositionsForUser,
//   quoteUsdcSingleSided,
//   withdrawPosition,
// } from "../services/liquidity.service.js";

const router = Router();


// router.post("/quote", requireAuth, validateBody(quoteSchema), async (req, res) => {
//   try {
//     const { user } = req as AuthenticatedRequest;
//     const { amount, rangePreset } = req.validatedBody as {
//       amount: string;
//       rangePreset: "narrow" | "balanced" | "wide";
//     };

//     const quote = await quoteUsdcSingleSided({
//       uid: user.uid,
//       amount,
//       rangePreset,
//     });

//     return res.json({ quote });
//   } catch (error) {
//     console.error("Quote failed:", error);
//     return res.status(500).json({ message: (error as Error).message });
//   }
// });

// router.post("/positions", requireAuth, validateBody(createPositionSchema), async (req, res) => {
//   try {
//     const { user } = req as AuthenticatedRequest;
//     const { amount, rangePreset } = req.validatedBody as {
//       amount: string;
//       rangePreset: "narrow" | "balanced" | "wide";
//     };

//     const position = await createUsdcPosition({
//       uid: user.uid,
//       amount,
//       rangePreset,
//     });

//     return res.json({ position });
//   } catch (error) {
//     console.error("Create position failed:", error);
//     return res.status(500).json({ message: (error as Error).message });
//   }
// });

router.get("/positions", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    // const positions = await listPositionsForUser(user.uid);
    return res.json({  });
  } catch (error) {
    console.error("List positions failed:", error);
    return res.status(500).json({ message: (error as Error).message });
  }
});

// router.post("/positions/:id/collect", requireAuth, async (req, res) => {
//   try {
//     const { user } = req as AuthenticatedRequest;
//     const positionId = req.params.id;
//     if (typeof positionId !== "string" || !positionId) {
//       return res.status(400).json({ message: "Missing position id." });
//     }
//     const result = await collectPositionFees({ uid: user.uid, positionId });
//     return res.json({ result });
//   } catch (error) {
//     console.error("Collect failed:", error);
//     return res.status(500).json({ message: (error as Error).message });
//   }
// });

// router.get("/positions/:id/status", validateQuery(uidQuerySchema), async (req, res) => {
//   try {
//     const { uid } = req.validatedQuery as { uid: string };

//     const positionId = req.params.id;
//     if (typeof positionId !== "string" || !positionId) {
//       return res.status(400).json({ message: "Missing position id." });
//     }

//     const status = await getPositionStatus({ uid, positionId });
//     return res.json({ status });
//   } catch (error) {
//     console.error("Get position status failed:", error);
//     return res.status(500).json({ message: (error as Error).message });
//   }
// });

// router.get("/positions/status/by-uid", validateQuery(uidQuerySchema), async (req, res) => {
//   try {
//     const { uid } = req.validatedQuery as { uid: string };

//     const positions = await listPositionsStatusForUser(uid);
//     return res.json({ positions });
//   } catch (error) {
//     console.error("List position statuses failed:", error);
//     return res.status(500).json({ message: (error as Error).message });
//   }
// });

// router.post("/positions/:id/withdraw", requireAuth, async (req, res) => {
//   try {
//     const { user } = req as AuthenticatedRequest;
//     const positionId = req.params.id;
//     if (typeof positionId !== "string" || !positionId) {
//       return res.status(400).json({ message: "Missing position id." });
//     }
//     const result = await withdrawPosition({ uid: user.uid, positionId });
//     return res.json({ result });
//   } catch (error) {
//     console.error("Withdraw position failed:", error);
//     return res.status(500).json({ message: (error as Error).message });
//   }
// });

export default router;
