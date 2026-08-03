import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

import { connectDB } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";

import eventRoutes from "./routes/eventRoutes.js";
import registrationRoutes from "./routes/registrationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect Database
connectDB();

// Ensure Uploads Directory & Default QR Image exist
const uploadsDir = path.resolve("uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Generate a dummy SVG default QR code image if not present
const defaultQrPath = path.join(uploadsDir, "default-qr.png");
if (!fs.existsSync(defaultQrPath)) {
  const dummySvgQR = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300" fill="none">
    <rect width="300" height="300" fill="#064e3b" rx="20"/>
    <rect x="20" y="20" width="80" height="80" fill="#10b981" rx="10"/>
    <rect x="35" y="35" width="50" height="50" fill="#022c22" rx="5"/>
    <rect x="200" y="20" width="80" height="80" fill="#10b981" rx="10"/>
    <rect x="215" y="35" width="50" height="50" fill="#022c22" rx="5"/>
    <rect x="20" y="200" width="80" height="80" fill="#10b981" rx="10"/>
    <rect x="35" y="215" width="50" height="50" fill="#022c22" rx="5"/>
    <rect x="120" y="40" width="60" height="30" fill="#34d399" rx="5"/>
    <rect x="120" y="80" width="30" height="60" fill="#34d399" rx="5"/>
    <rect x="120" y="160" width="70" height="40" fill="#34d399" rx="5"/>
    <rect x="200" y="120" width="70" height="50" fill="#34d399" rx="5"/>
    <rect x="120" y="220" width="140" height="50" fill="#10b981" rx="5"/>
    <text x="150" y="150" font-family="sans-serif" font-size="14" fill="#ffffff" text-anchor="middle" font-weight="bold">FARMFUSION</text>
  </svg>`;
  fs.writeFileSync(defaultQrPath, dummySvgQR);
}

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Static uploads serving
app.use("/uploads", express.static(uploadsDir));

// Mount Routes
app.use("/api/event", eventRoutes);
app.use("/api", registrationRoutes);
app.use("/api/admin", adminRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    name: "FarmFusion API Server",
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🌱 FarmFusion Server running on port: ${PORT}`);
  console.log(`==================================================\n`);
});
