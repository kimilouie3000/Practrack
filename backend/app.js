
import express from "express";
import cors from "cors";
import helmet from "helmet";
import {
  isValidStudentNumber,
  formatHours
} from "./src/utils/practrack.js";
import routes from "./src/routes.js";
import scheduleRoutes from "./src/scheduleRoutes.js";
import profileRoutes from "./src/profileRoutes.js";
import adminRoutes from "./src/adminRoutes.js";

const app = express();

const allowedOrigins = (
  process.env.CLIENT_URL || "http://localhost:5173"
).split(",").map(origin => origin.trim());

app.use(helmet());

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS."));
  }
}));

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api", (_req, res) => {
  res.json({
    name: "PracTrack API",
    status: "running"
  });
});

app.get("/api/utils/student-number/:value", (req, res) => {
  res.json({
    valid: isValidStudentNumber(req.params.value)
  });
});

app.get("/api/utils/hours/:minutes", (req, res) => {
  const minutes = Number(req.params.minutes);

  if (!Number.isInteger(minutes) || minutes < 0) {
    return res.status(400).json({
      message: "Minutes must be a non-negative whole number."
    });
  }

  res.json({
    minutes,
    formatted: formatHours(minutes)
  });
});

app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api", routes);

app.use("/api", (_req, res) => {
  res.status(404).json({
    message: "The requested API route was not found."
  });
});

app.use((error, _req, res, _next) => {
  if (error.message === "Origin not allowed by CORS.") {
    return res.status(403).json({
      message: "This website is not allowed to access the API."
    });
  }

  console.error(error);

  res.status(500).json({
    message: "An unexpected server error occurred."
  });
});

export default app;
