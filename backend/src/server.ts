// src/server.ts
import "dotenv/config";
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// =============================
// Constants & Environment
// =============================
const app: Application = express();
const PORT = 3000; // fixed port for backend
const FRONTEND_ORIGIN = "http://localhost:5173"; // Vite frontend port

// =============================
// Middleware
// =============================
app.use(helmet()); // security headers
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true // allows cookies/auth headers
}));
app.use(express.json()); // parse JSON bodies
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

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

// Example API endpoint
app.get("/api/test", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Backend API connection successful!",
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
  (err: unknown, req: Request, res: Response, next: NextFunction) => {
    const error = err instanceof Error ? err : new Error("Unknown error");
    console.error("🔥 Error:", error.message);

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
  console.log(`🚀 Backend running on port ${PORT}`);
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