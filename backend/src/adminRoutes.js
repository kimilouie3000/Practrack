import { isPracTrackEmail, isStrongPassword, studentRequiredMinutes, parseRequiredHours } from "./securityPolicy.js";

import { Router } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { User, TimeEntry } from "./models.js";
import { Schedule } from "./scheduleModel.js";
import { AdminEvent } from "./adminModels.js";
import { validateAdminRecord, applyRecordEdit, recordSnapshot, auditChange, handleAdjustmentError } from "./adjustmentService.js";

import {
  authenticate,
  allowRoles
} from "./middleware/auth.js";

import {
  isValidStudentNumber,
  validateDailyMinutes
} from "./utils/practrack.js";

const router = Router();

const getGoal = student => studentRequiredMinutes(student);
const STATES = ["pending", "approved", "rejected"];

const PROFILE_FIELDS = [
  "phone",
  "school",
  "course",
  "yearLevel",
  "section",
  "address",
  "bio"
];

router.use(authenticate, allowRoles("admin"));

function validId(id) {
  return mongoose.isValidObjectId(id);
}

function clean(value, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

function publicStudent(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    studentNo: user.studentNo,
    active: user.active,
    company: user.company || "",
    requiredMinutesOverride: user.requiredMinutesOverride ?? null,
    requiredMinutes: getGoal(user),
    assignedTeacher: user.assignedTeacher || null,
    assignedClient: user.assignedClient || null,
    profile: user.profile || {},
    createdAt: user.createdAt
  };
}

function localDate(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone:
      process.env.PRACTICUM_TIME_ZONE || "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const part = key =>
    parts.find(item => item.type === key)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validateRecord(body = {}) {
  try { return validateAdminRecord(body); }
  catch { return null; }
}

async function approvedMinutes(userId, exclude = null) {
  const match = {
    user: new mongoose.Types.ObjectId(String(userId)),
    status: "approved"
  };

  if (exclude) {
    match._id = {
      $ne: new mongoose.Types.ObjectId(String(exclude))
    };
  }

  const rows = await TimeEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: "$minutes" }
      }
    }
  ]);

  return rows[0]?.total || 0;
}

async function overlap(userId, record, exclude = null) {
  if (record.status === "rejected") return false;

  const query = {
    user: userId,
    status: { $ne: "rejected" },
    startAt: { $lt: record.endAt },
    $or: [
      { endAt: null },
      { endAt: { $gt: record.startAt } }
    ]
  };

  if (exclude) {
    query._id = { $ne: exclude };
  }

  return Boolean(await TimeEntry.exists(query));
}

async function audit(req, action, subject, details = "") {
  await AdminEvent.create({
    actor: req.user._id,
    action,
    subject: clean(subject),
    details: clean(details, 300)
  });
}

function studentFields(body = {}, existing = null) {
  const name = clean(body.name, 100);
  const email = clean(body.email, 190).toLowerCase();
  const studentNo = clean(body.studentNo, 30);

  if (
    name.length < 2 ||
    !(isPracTrackEmail(email) || (existing && email === existing.email)) ||
    !isValidStudentNumber(studentNo)
  ) {
    return null;
  }

  const data = {
    name,
    email,
    studentNo,
    company: clean(body.company, 120)
  };

  if (Object.hasOwn(body, "requiredHours")) {
    const parsed = parseRequiredHours(body.requiredHours);
    if (parsed === undefined) return null;
    data.requiredMinutesOverride = parsed;
  }

  if (body.active !== undefined) {
    data.active = Boolean(body.active);
  }

  data.profile = {};

  for (const field of PROFILE_FIELDS) {
    data.profile[field] = clean(
      body.profile?.[field] ??
      existing?.profile?.[field] ??
      "",
      field === "bio" ? 400 : 180
    );
  }

  return data;
}

function duplicateError(error, res) {
  if (error.code === 11000) {
    res.status(409).json({
      message: "Email or student number is already in use."
    });

    return true;
  }

  return false;
}

// ADMIN ANALYTICS

router.get("/overview", async (_req, res) => {
  const [
    totalStudents,
    pendingEntries,
    approved,
    recentEntries,
    recentActions
  ] = await Promise.all([
    User.countDocuments({
      role: "student",
      active: true
    }),

    TimeEntry.countDocuments({
      status: "pending"
    }),

    TimeEntry.aggregate([
      { $match: { status: "approved" } },
      {
        $group: {
          _id: null,
          total: { $sum: "$minutes" }
        }
      }
    ]),

    TimeEntry.find()
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate("user", "name studentNo")
      .lean(),

    AdminEvent.find()
      .sort({ createdAt: -1 })
      .limit(12)
      .populate("actor", "name")
      .lean()
  ]);

  res.json({
    totalStudents,
    pendingEntries,
    approvedMinutes: approved[0]?.total || 0,
    recentEntries,
    recentActions
  });
});

// LIST STUDENTS

router.get("/students", async (_req, res) => {
  const [students, totals] = await Promise.all([
    User.find({ role: "student" })
      .sort({ createdAt: -1 })
      .lean(),

    TimeEntry.aggregate([
      {
        $match: {
          status: { $in: ["approved", "pending"] }
        }
      },
      {
        $group: {
          _id: "$user",
          approvedMinutes: {
            $sum: {
              $cond: [
                { $eq: ["$status", "approved"] },
                "$minutes",
                0
              ]
            }
          },
          pendingCount: {
            $sum: {
              $cond: [
                { $eq: ["$status", "pending"] },
                1,
                0
              ]
            }
          }
        }
      }
    ])
  ]);

  const byId = new Map(
    totals.map(row => [String(row._id), row])
  );

  res.json({
    students: students.map(student => ({
      ...publicStudent(student),
      approvedMinutes:
        byId.get(String(student._id))?.approvedMinutes || 0,
      pendingCount:
        byId.get(String(student._id))?.pendingCount || 0
    }))
  });
});

// STUDENT DETAILS

router.get("/students/:id", async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid student ID."
    });
  }

  const student = await User.findOne({
    _id: req.params.id,
    role: "student"
  }).lean();

  if (!student) {
    return res.status(404).json({
      message: "Student not found."
    });
  }

  const [records, schedules, approved] = await Promise.all([
    TimeEntry.find({ user: student._id })
      .sort({ startAt: -1 })
      .lean(),

    Schedule.find({ user: student._id })
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean(),

    approvedMinutes(student._id)
  ]);

  res.json({
    student: publicStudent(student),
    records,
    schedules,
    approvedMinutes: approved,
    remainingMinutes: Math.max(0, getGoal(student) - approved),
    requiredMinutes: getGoal(student)
  });
});

// CREATE STUDENT

router.post("/students", async (req, res) => {
  const data = studentFields(req.body);
  const password = String(req.body.password || "");

  if (
    !data ||
    !isStrongPassword(password)
  ) {
    return res.status(400).json({
      message: "Enter valid student details and a password of 12–128 characters."
    });
  }

  try {
    const student = await User.create({
      ...data,
      role: "student",
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: true
    });

    await auditChange(req.user._id, "Student created", student.name, null,
      publicStudent(student), { targetId: student._id });

    return res.status(201).json({
      student: publicStudent(student)
    });
  } catch (error) {
    if (duplicateError(error, res)) return;
    throw error;
  }
});

// UPDATE STUDENT

router.patch("/students/:id", async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid student ID."
    });
  }

  const student = await User.findOne({
    _id: req.params.id,
    role: "student"
  });

  if (!student) {
    return res.status(404).json({
      message: "Student not found."
    });
  }

  if (student.archivedAt && req.body?.active === true) {
    return res.status(409).json({ message: "Restore archived students using the Restore action." });
  }
  const data = studentFields(req.body, student);

  if (!data) {
    return res.status(400).json({
      message: "Invalid student details."
    });
  }

  const password = req.body.password;

  if (
    password !== undefined &&
    password !== "" &&
    (
      typeof password !== "string" ||
      !isStrongPassword(password)
    )
  ) {
    return res.status(400).json({
      message: "New password must be 12–128 characters."
    });
  }

  try {
    const before = publicStudent(student);
    student.set(data);

    if (password) {
      student.passwordHash = await bcrypt.hash(password, 12);
      student.mustChangePassword = true;
      student.passwordVersion = Number(student.passwordVersion || 0) + 1;
      student.failedLoginAttempts = 0;
      student.lockedUntil = null;
    }

    await student.save();

    await auditChange(req.user._id, "Student updated", student.name,
      before, publicStudent(student), {
        targetId: student._id,
        note: clean(req.body.targetChangeReason, 300)
      });

    res.json({
      student: publicStudent(student)
    });
  } catch (error) {
    if (duplicateError(error, res)) return;
    throw error;
  }
});

// DELETE STUDENT

// Archive preserves attendance, evaluations, requests, and history.
router.delete("/students/:id", async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid student ID." });
  const student = await User.findOne({ _id: req.params.id, role: "student" });
  if (!student) return res.status(404).json({ message: "Student not found." });
  const before = { active: student.active, archivedAt: student.archivedAt };
  student.active = false;
  student.archivedAt = new Date();
  student.passwordVersion = Number(student.passwordVersion || 0) + 1;
  await student.save();
  await auditChange(req.user._id, "Student archived", student.name, before,
    { active: false, archivedAt: student.archivedAt }, { targetId: student._id });
  return res.json({ message: "Student archived. Attendance and history were preserved." });
});

router.patch("/students/:id/restore", async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid student ID." });
  const student = await User.findOne({ _id: req.params.id, role: "student" });
  if (!student) return res.status(404).json({ message: "Student not found." });
  student.active = true;
  student.archivedAt = null;
  await student.save();
  await auditChange(req.user._id, "Student restored", student.name, { active: false },
    { active: true }, { targetId: student._id });
  return res.json({ message: "Student restored." });
});

// Permanent purge intentionally requires a separate endpoint and exact phrase.
router.delete("/students/:id/purge", async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid student ID." });
  const student = await User.findOne({ _id: req.params.id, role: "student" });
  if (!student) return res.status(404).json({ message: "Student not found." });
  if (student.active || !student.archivedAt) return res.status(409).json({ message: "Archive the student before purging." });
  if (req.body?.confirmation !== `PURGE ${student.studentNo}`) {
    return res.status(400).json({ message: `Type PURGE ${student.studentNo} to confirm deletion.` });
  }
  // A transaction is essential here: do not leave orphaned records or half-purged accounts.
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { Evaluation, AdjustmentRequest } = await import("./portalModels.js");
      await TimeEntry.deleteMany({ user: student._id }, { session });
      await Schedule.deleteMany({ user: student._id }, { session });
      await Evaluation.deleteMany({ student: student._id }, { session });
      await AdjustmentRequest.deleteMany({ student: student._id }, { session });
      await User.deleteOne({ _id: student._id }, { session });
      await auditChange(req.user._id, "Student permanently purged", student.name,
        { studentId: student._id }, { deleted: true }, { targetId: student._id, session });
    });
    return res.json({ message: "Student permanently purged." });
  } finally { await session.endSession(); }
});

// LIST ATTENDANCE RECORDS

router.get("/records", async (req, res) => {
  const query = {};

  if (req.query.studentId) {
    if (!validId(req.query.studentId)) {
      return res.status(400).json({
        message: "Invalid student ID."
      });
    }

    query.user = req.query.studentId;
  }

  if (req.query.status) {
    if (
      !["active", ...STATES].includes(req.query.status)
    ) {
      return res.status(400).json({
        message: "Invalid status."
      });
    }

    query.status = req.query.status;
  }

  const page = Math.max(
    1,
    Math.min(
      10000,
      Number.parseInt(req.query.page, 10) || 1
    )
  );

  const limit = 25;

  const [entries, total] = await Promise.all([
    TimeEntry.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name studentNo email"),

    TimeEntry.countDocuments(query)
  ]);

  res.json({
    entries,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit))
  });
});

// MANUALLY ADD ATTENDANCE RECORD

router.post("/records", async (req, res) => {
  if (!validId(req.body.userId)) {
    return res.status(400).json({
      message: "Select a student."
    });
  }

  const student = await User.findOne({
    _id: req.body.userId,
    role: "student",
    active: true
  });

  if (!student) {
    return res.status(404).json({
      message: "Active student not found."
    });
  }

  const data = validateRecord(req.body);

  if (!data) {
    return res.status(400).json({
      message: "Invalid attendance dates, duration, description or status."
    });
  }

  if (data.status === "approved" &&
      (await approvedMinutes(student._id)) + data.minutes > getGoal(student) &&
      !(data.allowOverTarget && data.hourAdjustmentReason.length >= 10)) {
    return res.status(400).json({ message: "Over-target creation requires an explicit Admin override and a reason of at least 10 characters." });
  }

  if (await overlap(student._id, data)) {
    return res.status(409).json({
      message: "Entry overlaps another attendance record."
    });
  }


  const entry = await TimeEntry.create({
    ...data,
    user: student._id,
    ...(data.status !== "pending"
      ? {
          reviewedBy: req.user._id,
          reviewedAt: new Date()
        }
      : {})
  });

  await auditChange(req.user._id, "Record created", student.name, null,
    recordSnapshot(entry), {
      targetId: entry._id, note: data.hourAdjustmentReason
    });

  res.status(201).json({ entry });
});

// EDIT ATTENDANCE RECORD

router.patch("/records/:id", async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid record ID." });
    const entry = await TimeEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Record not found." });
    await applyRecordEdit(entry, req.body, req.user._id, { action: "Admin record edited" });
    return res.json({ entry });
  } catch (error) { return handleAdjustmentError(error, res, next); }
});

// APPROVE OR REJECT ENTRY

router.patch("/records/:id/review", async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid record ID."
    });
  }

  const entry = await TimeEntry.findById(req.params.id);

  if (!entry || entry.status !== "pending") {
    return res.status(404).json({
      message: "Pending record not found."
    });
  }

  const status = req.body.status;
  const reason = clean(req.body.reason, 300);

  if (
    !["approved", "rejected"].includes(status) ||
    (status === "rejected" && reason.length < 5)
  ) {
    return res.status(400).json({
      message: "Choose approved or rejected, with a reason when rejecting."
    });
  }


  if (status === "approved") {
    const matching = await TimeEntry.aggregate([
      { $match: { user: entry.user, status: "approved", _id: { $ne: entry._id } } },
      { $group: { _id: null, minutes: { $sum: "$minutes" } } }
    ]);
    const student = await User.findById(entry.user).select("requiredMinutesOverride").lean();
    const wouldExceed = (matching[0]?.minutes || 0) + entry.minutes > getGoal(student);
    if (wouldExceed && (req.body?.allowOverTarget !== true || reason.length < 10)) {
      return res.status(400).json({ message: "Over-target approval requires the explicit flag and an explanation of at least 10 characters." });
    }
  }

  const result = await TimeEntry.findOneAndUpdate(
    {
      _id: entry._id,
      status: "pending"
    },
    {
      $set: {
        status,
        rejectionReason:
          status === "rejected" ? reason : "",
        reviewedBy: req.user._id,
        reviewedAt: new Date()
      }
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!result) {
    return res.status(409).json({
      message: "Entry has already been reviewed."
    });
  }

  await auditChange(req.user._id, status === "approved" ? "Hours approved" : "Hours rejected",
    String(entry.user), recordSnapshot(entry), recordSnapshot(result), { targetId: entry._id });

  res.json({ entry: result });
});

// DELETE ATTENDANCE RECORD

router.delete("/records/:id", async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid record ID."
    });
  }

  const entry = await TimeEntry.findById(req.params.id);

  if (!entry) {
    return res.status(404).json({
      message: "Record not found."
    });
  }

  if (entry.status === "active") {
    return res.status(409).json({
      message: "Active sessions cannot be deleted."
    });
  }

  const before = recordSnapshot(entry);
  await TimeEntry.deleteOne({ _id: entry._id });
  await auditChange(req.user._id, "Record deleted", String(entry.user), before,
    null, { targetId: entry._id });

  res.json({
    message: "Record deleted."
  });
});

export default router;
