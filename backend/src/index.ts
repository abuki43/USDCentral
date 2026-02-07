import cors from "cors";
import express from "express";

import authRouter from "./routes/auth.route.js";
import bridgeRouter from "./routes/bridge.route.js";
import circleRouter from "./routes/circle.route.js";
import liquidityRouter from "./routes/liquidity.route.js";
import transferRouter from "./routes/transfer.route.js";
import webhooksRouter from "./routes/webhooks.route.js";
import { processPendingSwapJobsOnce } from "./services/swap.service.js";
import { startQueueWorkers } from "./services/queue.service.js";
import { processBridgeToBaseJob } from "./services/webhooks.service.js";
import { config } from "./config.js";
import { requestContext } from "./middleware/requestContext.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./lib/logger.js";





const app = express();

app.use(cors());
app.use(requestContext);

// Webhooks require the raw body for signature verification.
app.use("/webhooks", webhooksRouter);

app.use(express.json());

app.get("/", (_req, res) => {
    res.status(200).json({ success: true });
});

app.use("/auth", authRouter);
app.use("/circle", circleRouter);
app.use("/bridge", bridgeRouter);
app.use("/liquidity", liquidityRouter);
app.use("/transfer", transferRouter);

const port = config.PORT;

app.use(errorHandler);

app.listen(port, () => {
    logger.info({ port }, "Server is running");

    startQueueWorkers({
        bridgeToBase: processBridgeToBaseJob,
        swapProcess: async () => {
            await processPendingSwapJobsOnce({ limit: 1 });
        },
    }).catch((err) => {
        logger.error({ err }, "Failed to start queue workers");
    });

    if (config.swapWorkerEnabled) {
        const intervalMs = Number.isFinite(config.swapWorkerIntervalMs)
            ? config.swapWorkerIntervalMs
            : 5000;
        setInterval(() => {
            processPendingSwapJobsOnce({ limit: 3 }).catch((e) => {
                logger.error({ err: e }, "swap worker error");
            });
        }, intervalMs);
    }
});
