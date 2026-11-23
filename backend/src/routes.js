import { rateLimit } from "express-rate-limit";
import { normalizedEmail, isPracTrackEmail, isStrongPassword, AUTH_LIMIT, AUTH_LOCK_MS, requiredMinutes, studentRequiredMinutes } from "./securityPolicy.js";

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User, TimeEntry } from "./models.js";
import { auditChange, recordSnapshot } from "./adjustmentService.js";
import {
  authenticate,
  allowRoles
} from "./middleware/auth.js";
import {
  isValidStudentNumber,
  validateDailyMinutes
} from "./utils/practrack.js";

const router = Router();

function makeToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, ver: Number(user.passwordVersion || 0) },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    studentNo: user.studentNo || "",
    role: user.role,
    mustChangePassword: Boolean(user.mustChangePassword),
    company: user.company || ""
  };
}

function dateString(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.PRACTICUM_TIME_ZONE || "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const part = type =>
    parts.find(item => item.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validEntryTimes(startValue, endValue) {
  const start = new Date(startValue);
  const end = new Date(endValue);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return null;
  }

  const minutes = Math.round(
    (end.getTime() - start.getTime()) / 60000
  );

  if (!validateDailyMinutes(minutes)) return null;
  if (end > new Date()) return null;

  return { start, end, minutes };
}

async function hasOverlap(userId, start, end, excludeId = null) {
  const query = {
    user: userId,
    status: { $ne: "rejected" },
    startAt: { $lt: end },
    $or: [
      { endAt: null },
      { endAt: { $gt: start } }
    ]
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return TimeEntry.exists(query);
}

// AUTHENTICATION

// Per-instance IP throttle plus persistent per-account lockout for incorrect logins.
// For multi-instance deployment, configure a shared rate-limit store.
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30,
  standardHeaders: "draft-8", legacyHeaders: false,
  message: { message: "Too many login attempts. Try again later." }
});
const registerLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 10,
  standardHeaders: "draft-8", legacyHeaders: false,
  message: { message: "Too many registrations. Try again later." }
});

router.post("/auth/register", registerLimiter, async (req, res) => {
  try {
    const { name, email, password, studentNo } = req.body;

    if (!name?.trim() || !email?.trim() || !password || !studentNo) {
      return res.status(400).json({
        message: "Complete all required fields."
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: "Password must be 12–128 characters."
      });
    }
    if (!isPracTrackEmail(email)) {
      return res.status(400).json({ message: "Use a username@practrack.com login address." });
    }

    if (!isValidStudentNumber(studentNo)) {
      return res.status(400).json({
        message: "Use the student number format YYYY-NNNNN."
      });
    }

    const accountEmail = normalizedEmail(email);

    const exists = await User.exists({
      $or: [
        { email: accountEmail },
        { studentNo: studentNo.trim() }
      ]
    });

    if (exists) {
      return res.status(409).json({
        message: "Email or student number is already registered."
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: accountEmail,
      studentNo: studentNo.trim(),
      passwordHash: await bcrypt.hash(password, 12),
      role: "student"
    });

    return res.status(201).json({
      token: makeToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Account details are already in use."
      });
    }

    return res.status(500).json({
      message: "Could not create your account."
    });
  }
});

router.post("/auth/login", loginLimiter, async (req, res) => {
  const email = normalizedEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) return res.status(400).json({ message: "Email and password are required." });

  // Existing non-PracTrack addresses remain usable until an admin transitions them.
  const user = await User.findOne({ email }).select("+failedLoginAttempts +lockedUntil");
  const failure = { message: "Incorrect email or password." };
  if (!user || !user.active || user.archivedAt) return res.status(401).json(failure);
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return res.status(423).json({ message: "Account temporarily locked. Try again in 15 minutes or contact an admin." });
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    const failures = Number(user.failedLoginAttempts || 0) + 1;
    user.failedLoginAttempts = failures;
    if (failures >= AUTH_LIMIT) {
      user.lockedUntil = new Date(Date.now() + AUTH_LOCK_MS);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    return res.status(401).json(failure);
  }
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();
  return res.json({ token: makeToken(user), user: publicUser(user) });
});

router.post("/auth/change-password", loginLimiter, authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ message: "New password must be 12–128 characters." });
  }
  const user = await User.findById(req.user._id);
  if (!user || !(await bcrypt.compare(String(currentPassword || ""), user.passwordHash))) {
    return res.status(400).json({ message: "Current password is incorrect." });
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    return res.status(400).json({ message: "Choose a different password." });
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.mustChangePassword = false;
  user.passwordVersion = Number(user.passwordVersion || 0) + 1;
  user.passwordChangedAt = new Date();
  await user.save();
  return res.json({ token: makeToken(user), user: publicUser(user) });
});

router.get("/auth/me", authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.get("/settings/public", (_req, res) => {
  res.json({ requiredMinutes: requiredMinutes() });
});

// ATTENDANCE RECORDS

router.get("/logs", authenticate, async (req, res) => {
  const query = {};

  if (req.user.role === "student") {
    query.user = req.user._id;
  } else if (["teacher", "client"].includes(req.user.role)) {
    const assignment = req.user.role === "teacher" ? "assignedTeacher" : "assignedClient";
    const students = await User.find({ role: "student", active: true, [assignment]: req.user._id }).select("_id");
    query.user = { $in: students.map(student => student._id) };
    if (req.query.studentId) {
      if (!mongoose.isValidObjectId(req.query.studentId)) return res.status(400).json({ message: "Invalid student ID." });
      if (!students.some(student => String(student._id) === String(req.query.studentId))) {
        return res.status(403).json({ message: "Student not assigned to your account." });
      }
      query.user = req.query.studentId;
    }
    if (req.user.role === "client") query.status = "approved";
  } else if (req.query.studentId) {
    if (!mongoose.isValidObjectId(req.query.studentId)) {
      return res.status(400).json({
        message: "Invalid student ID."
      });
    }

    query.user = req.query.studentId;
  }

  if (req.query.status) {
    if (req.user.role === "client" && req.query.status !== "approved") {
      return res.status(403).json({ message: "Clients can only view approved attendance." });
    }
    query.status = req.query.status;
  }

  if (req.query.from || req.query.to) {
    query.date = {};

    if (req.query.from) {
      query.date.$gte = req.query.from;
    }

    if (req.query.to) {
      query.date.$lte = req.query.to;
    }
  }

  const entries = await TimeEntry.find(query)
    .populate("user", "name email studentNo")
    .sort({ createdAt: -1 })
    .limit(500);

  res.json({ entries });
});

// CLOCK IN

router.post(
  "/logs/clock-in",
  authenticate,
  allowRoles("student"),
  async (req, res) => {
    const active = await TimeEntry.findOne({
      user: req.user._id,
      status: "active"
    });

    if (active) {
      return res.status(409).json({
        message: "You already have an active clock-in."
      });
    }

    const now = new Date();

    const entry = await TimeEntry.create({
      user: req.user._id,
      date: dateString(now),
      startAt: now,
      description: "Practicum attendance",
      company: req.user.company,
      status: "active"
    });

    return res.status(201).json({ entry });
  }
);

// CLOCK OUT

router.post(
  "/logs/clock-out",
  authenticate,
  allowRoles("student"),
  async (req, res) => {
    const entry = await TimeEntry.findOne({
      user: req.user._id,
      status: "active"
    });

    if (!entry) {
      return res.status(404).json({
        message: "No active clock-in was found."
      });
    }

    const now = new Date();

    const minutes = Math.floor(
      (now.getTime() - entry.startAt.getTime()) / 60000
    );

    if (minutes < 1) {
      return res.status(400).json({
        message: "Clock-out is available after at least one full minute."
      });
    }

    entry.endAt = now;
    entry.minutes = minutes;

    if (!validateDailyMinutes(minutes)) {
      entry.status = "rejected";
      entry.rejectionReason =
        "Session exceeded the 12-hour daily limit. Please correct the recorded times.";

      await entry.save();

      return res.json({
        message: "Session exceeded the 12-hour limit. Correct the rejected record.",
        entry
      });
    }

    entry.status = "pending";
    entry.rejectionReason = "";

    await entry.save();

    return res.json({
      message: "Clock-out submitted for approval.",
      entry
    });
  }
);

// CREATE MANUAL RECORD

router.post(
  "/logs",
  authenticate,
  allowRoles("student"),
  async (req, res) => {
    const {
      startAt,
      endAt,
      description,
      company
    } = req.body;

    const cleanDescription = String(description || "").trim();

    if (cleanDescription.length < 20) {
      return res.status(400).json({
        message: "Description must contain at least 20 characters."
      });
    }

    const times = validEntryTimes(startAt, endAt);

    if (!times) {
      return res.status(400).json({
        message: "Enter valid past start and end times. A daily entry cannot exceed 12 hours."
      });
    }

    if (dateString(times.start) !== dateString(times.end)) {
      return res.status(400).json({
        message: "An entry must start and end on the same date."
      });
    }

    if (await hasOverlap(req.user._id, times.start, times.end)) {
      return res.status(409).json({
        message: "This entry overlaps another time entry."
      });
    }

    const entry = await TimeEntry.create({
      user: req.user._id,
      date: dateString(times.start),
      startAt: times.start,
      endAt: times.end,
      minutes: times.minutes,
      description: cleanDescription,
      company: String(
        company || req.user.company || ""
      ).trim(),
      status: "pending"
    });

    return res.status(201).json({ entry });
  }
);

// CORRECT AND RESUBMIT REJECTED RECORD

router.patch(
  "/logs/:id/resubmit",
  authenticate,
  allowRoles("student"),
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid entry ID."
      });
    }

    const entry = await TimeEntry.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: "rejected"
    });

    if (!entry) {
      return res.status(404).json({
        message: "Rejected entry not found."
      });
    }

    const description = String(
      req.body.description || ""
    ).trim();

    const times = validEntryTimes(
      req.body.startAt,
      req.body.endAt
    );

    if (
      description.length < 20 ||
      !times ||
      dateString(times.start) !== dateString(times.end)
    ) {
      return res.status(400).json({
        message: "Check the description and time range."
      });
    }

    if (
      await hasOverlap(
        req.user._id,
        times.start,
        times.end,
        entry._id
      )
    ) {
      return res.status(409).json({
        message: "This entry overlaps another time entry."
      });
    }

    entry.date = dateString(times.start);
    entry.startAt = times.start;
    entry.endAt = times.end;
    entry.minutes = times.minutes;
    entry.description = description;
    entry.company = String(
      req.body.company || entry.company
    ).trim();

    entry.status = "pending";
    entry.rejectionReason = "";
    entry.reviewedBy = undefined;
    entry.reviewedAt = undefined;

    await entry.save();

    return res.json({ entry });
  }
);

// APPROVE OR REJECT HOURS

router.patch(
  "/logs/:id/review",
  authenticate,
  allowRoles("admin"),
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid entry ID."
      });
    }

    const { status, reason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Choose approved or rejected."
      });
    }

    if (
      status === "rejected" &&
      String(reason || "").trim().length < 5
    ) {
      return res.status(400).json({
        message: "Provide a rejection reason."
      });
    }

    const entry = await TimeEntry.findById(req.params.id);

    if (!entry || entry.status !== "pending") {
      return res.status(404).json({
        message: "Pending entry not found."
      });
    }

    const before = recordSnapshot(entry);
    if (status === "approved") {
      const approved = await TimeEntry.aggregate([
        { $match: { user: entry.user, status: "approved", _id: { $ne: entry._id } } },
        { $group: { _id: null, minutes: { $sum: "$minutes" } } }
      ]);
      const student = await User.findById(entry.user).select("requiredMinutesOverride").lean();
      const exceedsTarget = (approved[0]?.minutes || 0) + entry.minutes > studentRequiredMinutes(student);
      if (exceedsTarget && (req.user.role !== "admin" || req.body?.allowOverTarget !== true || String(reason || "").trim().length < 10)) {
        return res.status(400).json({ message: "Hours exceed the target. Only Admin can approve beyond it with an explicit flag and reason." });
      }
    }

    entry.status = status;
    entry.rejectionReason =
      status === "rejected"
        ? String(reason).trim()
        : "";

    entry.reviewedBy = req.user._id;
    entry.reviewedAt = new Date();

    await entry.save();
    await auditChange(req.user._id, `Admin ${status} hours`, String(entry.user),
      before, recordSnapshot(entry), { targetId: entry._id });

    return res.json({ entry });
  }
);

// STUDENT DIRECTORY

router.get(
  "/users",
  authenticate,
  allowRoles("teacher", "admin"),
  async (req, res) => {
    const query = { role: "student", active: true };
    if (req.user.role === "teacher") query.assignedTeacher = req.user._id;
    const users = await User.find(query)
      .select("name email studentNo company")
      .sort({ name: 1 });

    return res.json({ users });
  }
);

export default router;
