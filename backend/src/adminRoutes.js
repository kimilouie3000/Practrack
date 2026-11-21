
import { Router } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { User, TimeEntry } from "./models.js";
import { Schedule } from "./scheduleModel.js";
import { AdminEvent } from "./adminModels.js";

import {
  authenticate,
  allowRoles
} from "./middleware/auth.js";

import {
  isValidStudentNumber,
  validateDailyMinutes
} from "./utils/practrack.js";

const router = Router();

const GOAL = 240 * 60;
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
  const start = new Date(body.startAt);
  const end = new Date(body.endAt);
  const minutes = Math.floor((end - start) / 60000);

  const status = body.status || "pending";
  const description = clean(body.description, 2000);
  const reason = clean(body.rejectionReason, 300);

  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    !validateDailyMinutes(minutes) ||
    end > new Date() ||
    localDate(start) !== localDate(end) ||
    description.length < 20 ||
    !STATES.includes(status) ||
    (status === "rejected" && reason.length < 5)
  ) {
    return null;
  }

  return {
    startAt: start,
    endAt: end,
    minutes,
    date: localDate(start),
    status,
    description,
    company: clean(body.company, 120),
    rejectionReason: status === "rejected" ? reason : ""
  };
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
    !/^\S+@\S+\.\S+$/.test(email) ||
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
    remainingMinutes: Math.max(0, GOAL - approved)
  });
});

// CREATE STUDENT

router.post("/students", async (req, res) => {
  const data = studentFields(req.body);
  const password = String(req.body.password || "");

  if (
    !data ||
    password.length < 8 ||
    password.length > 128
  ) {
    return res.status(400).json({
      message: "Enter valid student details and a password of 8–128 characters."
    });
  }

  try {
    const student = await User.create({
      ...data,
      role: "student",
      passwordHash: await bcrypt.hash(password, 12)
    });

    await audit(
      req,
      "Student created",
      student.name,
      student.studentNo
    );

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
      password.length < 8 ||
      password.length > 128
    )
  ) {
    return res.status(400).json({
      message: "New password must be 8–128 characters."
    });
  }

  try {
    student.set(data);

    if (password) {
      student.passwordHash =
        await bcrypt.hash(password, 12);
    }

    await student.save();

    await audit(
      req,
      "Student updated",
      student.name,
      student.studentNo
    );

    res.json({
      student: publicStudent(student)
    });
  } catch (error) {
    if (duplicateError(error, res)) return;
    throw error;
  }
});

// DELETE STUDENT

router.delete("/students/:id", async (req, res) => {
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

  student.active = false;
  await student.save();

  await Promise.all([
    TimeEntry.deleteMany({ user: student._id }),
    Schedule.deleteMany({ user: student._id })
  ]);

  await User.deleteOne({
    _id: student._id,
    role: "student"
  });

  await audit(
    req,
    "Student deleted",
    student.name,
    student.studentNo
  );

  res.json({
    message: "Student and associated records permanently deleted."
  });
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

  if (await overlap(student._id, data)) {
    return res.status(409).json({
      message: "Entry overlaps another attendance record."
    });
  }

  if (
    data.status === "approved" &&
    (await approvedMinutes(student._id)) +
      data.minutes > GOAL
  ) {
    return res.status(400).json({
      message: "Approved hours would exceed 240 hours."
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

  await audit(
    req,
    "Record created",
    student.name,
    `${data.status}: ${data.minutes} minutes`
  );

  res.status(201).json({ entry });
});

// EDIT ATTENDANCE RECORD

router.patch("/records/:id", async (req, res) => {
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
      message: "Clock out the active session before editing."
    });
  }

  const student = await User.findOne({
    _id: entry.user,
    role: "student"
  });

  if (!student) {
    return res.status(404).json({
      message: "Student not found."
    });
  }

  const data = validateRecord(req.body);

  if (!data) {
    return res.status(400).json({
      message: "Invalid attendance details."
    });
  }

  if (await overlap(student._id, data, entry._id)) {
    return res.status(409).json({
      message: "Overlapping record."
    });
  }

  if (
    data.status === "approved" &&
    (await approvedMinutes(student._id, entry._id)) +
      data.minutes > GOAL
  ) {
    return res.status(400).json({
      message: "Approved hours would exceed 240 hours."
    });
  }

  entry.set(data);

  entry.reviewedBy =
    data.status !== "pending"
      ? req.user._id
      : null;

  entry.reviewedAt =
    data.status !== "pending"
      ? new Date()
      : null;

  await entry.save();

  await audit(
    req,
    "Record updated",
    student.name,
    `${data.status}: ${data.minutes} minutes`
  );

  res.json({ entry });
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

  if (
    status === "approved" &&
    (await approvedMinutes(entry.user, entry._id)) +
      entry.minutes > GOAL
  ) {
    return res.status(400).json({
      message: "Approved hours would exceed 240 hours."
    });
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

  await audit(
    req,
    status === "approved"
      ? "Hours approved"
      : "Hours rejected",
    String(entry.user),
    `${entry.minutes} minutes`
  );

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

  await TimeEntry.deleteOne({ _id: entry._id });

  await audit(
    req,
    "Record deleted",
    String(entry.user),
    `${entry.status}: ${entry.minutes} minutes`
  );

  res.json({
    message: "Record deleted."
  });
});

export default router;
