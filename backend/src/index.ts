import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import authRouter from "./routes/auth.route.js";
import circleRouter from "./routes/circle.route.js";
import webhooksRouter from "./routes/webhooks.route.js";

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
});