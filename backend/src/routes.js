
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User, TimeEntry } from "./models.js";
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
    { id: user._id, role: user.role },
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

router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, studentNo } = req.body;

    if (!name?.trim() || !email?.trim() || !password || !studentNo) {
      return res.status(400).json({
        message: "Complete all required fields."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters."
      });
    }

    if (!isValidStudentNumber(studentNo)) {
      return res.status(400).json({
        message: "Use the student number format YYYY-NNNNN."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const exists = await User.exists({
      $or: [
        { email: normalizedEmail },
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
      email: normalizedEmail,
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

router.post("/auth/login", async (req, res) => {
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();

  const password = String(req.body.password || "");

  const user = await User.findOne({ email });

  if (
    !user ||
    !user.active ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    return res.status(401).json({
      message: "Incorrect email or password."
    });
  }

  return res.json({
    token: makeToken(user),
    user: publicUser(user)
  });
});

router.get("/auth/me", authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ATTENDANCE RECORDS

router.get("/logs", authenticate, async (req, res) => {
  const query = {};

  if (req.user.role === "student") {
    query.user = req.user._id;
  } else if (req.query.studentId) {
    if (!mongoose.isValidObjectId(req.query.studentId)) {
      return res.status(400).json({
        message: "Invalid student ID."
      });
    }

    query.user = req.query.studentId;
  }

  if (req.query.status) {
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
  allowRoles("coordinator", "admin"),
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

    if (status === "approved") {
      const approved = await TimeEntry.aggregate([
        {
          $match: {
            user: entry.user,
            status: "approved",
            _id: { $ne: entry._id }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$minutes" }
          }
        }
      ]);

      const total = approved[0]?.total || 0;

      if (total + entry.minutes > 240 * 60) {
        return res.status(400).json({
          message: "Approving this entry would exceed the current 240-hour requirement."
        });
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

    return res.json({ entry });
  }
);

// STUDENT DIRECTORY

router.get(
  "/users",
  authenticate,
  allowRoles("coordinator", "admin"),
  async (_req, res) => {
    const users = await User.find({
      role: "student",
      active: true
    })
      .select("name email studentNo company")
      .sort({ name: 1 });

    return res.json({ users });
  }
);

export default router;
