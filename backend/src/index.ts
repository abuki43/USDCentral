import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import authRouter from "./routes/auth.route.js";

dotenv.config({ path: ".env.local" });

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
    res.json({ success: true });
});

app.use("/auth", authRouter);

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});