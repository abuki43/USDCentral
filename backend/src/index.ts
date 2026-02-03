import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import authRouter from "./routes/auth.route.js";
import circleRouter from "./routes/circle.route.js";
import webhooksRouter from "./routes/webhooks.route.js";
import { processPendingSwapJobsOnce } from "./services/swap.service.js";

dotenv.config({ path: ".env.local" });
dotenv.config();





const app = express();

app.use(cors());

// Webhooks require the raw body for signature verification.
app.use("/webhooks", webhooksRouter);

app.use(express.json());

app.get("/", (_req, res) => {
    res.status(200).json({ success: true });
});

app.use("/auth", authRouter);
app.use("/circle", circleRouter);

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);

    const enabled = (process.env.SWAP_WORKER_ENABLED ?? "true").toLowerCase() !== "false";
    if (enabled) {
        const intervalMs = Number(process.env.SWAP_WORKER_INTERVAL_MS ?? "5000");
        setInterval(() => {
            processPendingSwapJobsOnce({ limit: 3 }).catch((e) => {
                console.error("swap worker error", (e as Error).message);
            });
        }, Number.isFinite(intervalMs) ? intervalMs : 5000);
    }
});
