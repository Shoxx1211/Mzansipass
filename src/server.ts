// src/server.ts

import "dotenv/config";
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// =============================
// Environment Validation
// =============================

const requiredEnv = ["PORT"];

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
});

// =============================
// App Initialization
// =============================

const app: Application = express();
const PORT: number = Number(process.env.PORT) || 3000;

// =============================
// Global Middleware
// =============================

app.use(helmet()); // Security headers
app.use(cors());   // Cross-origin requests
app.use(express.json()); // JSON body parsing
app.use(morgan("dev")); // HTTP request logging

// =============================
// Routes
// =============================

// Root route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "MzansiPass API is running 🚀",
    environment: process.env.NODE_ENV || "development",
  });
});

// Health check (used in production monitoring)
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

// =============================
// 404 Handler
// =============================

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// =============================
// Global Error Handler
// =============================

app.use(
  (err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("🔥 Error:", err.message);

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
);

// =============================
// Graceful Shutdown
// =============================

const server = app.listen(PORT, () => {
  console.log("=================================");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 http://localhost:${PORT}`);
  console.log("=================================");
});

process.on("SIGINT", () => {
  console.log("🛑 Gracefully shutting down...");
  server.close(() => {
    console.log("✅ Server closed.");
    process.exit(0);
  });
});
