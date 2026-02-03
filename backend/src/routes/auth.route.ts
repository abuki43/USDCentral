import { Router } from "express";

import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";

const router = Router();

router.get("/me", requireAuth, (req, res) => {
    const { user } = req as AuthenticatedRequest;
    res.json({
        uid: user.uid,
        email: user.email ?? null,
        name: user.name ?? null,
    });
});

export default router;