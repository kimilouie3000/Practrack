import { studentRequiredMinutes } from "./securityPolicy.js";
import { Router } from "express";
import mongoose from "mongoose";
import { User, TimeEntry } from "./models.js";
import { Schedule } from "./scheduleModel.js";
import { Evaluation, AdjustmentRequest } from "./portalModels.js";
import { authenticate, allowRoles } from "./middleware/auth.js";
import {
  validateAdminRecord, validateSchedule,
  recordSnapshot, scheduleSnapshot, handleAdjustmentError, auditChange
} from "./adjustmentService.js";

const teacherRouter = Router();
const clientRouter = Router();
teacherRouter.use(authenticate, allowRoles("teacher"));
clientRouter.use(authenticate, allowRoles("client"));

const validId = id => mongoose.isValidObjectId(id);
const objectId = value => value?._id || value;
const publicStudent = u => ({
  _id: u._id, name: u.name, email: u.email, studentNo: u.studentNo,
  company: u.company, profile: u.profile, requiredMinutes: studentRequiredMinutes(u), assignedTeacher: u.assignedTeacher,
  assignedClient: u.assignedClient
});
const clientStudent = u => ({
  _id: u._id, name: u.name, studentNo: u.studentNo, company: u.company || "", requiredMinutes: studentRequiredMinutes(u)
});

async function assignedStudent(req, res, field, id) {
  if (!validId(id)) {
    res.status(400).json({ message: "Invalid student ID." });
    return null;
  }
  const student = await User.findOne({ _id: id, role: "student", active: true, [field]: req.user._id });
  if (!student) {
    // No data leakage through an unassigned student's ID.
    res.status(403).json({ message: "This student is not assigned to your account." });
    return null;
  }
  return student;
}

async function overview(req, res, field) {
  const students = await User.find({ role: "student", active: true, [field]: req.user._id })
    .select("name studentNo company profile assignedTeacher assignedClient email requiredMinutesOverride").lean();
  const ids = students.map(u => u._id);
  const filter = { user: { $in: ids } };
  if (field === "assignedClient") filter.status = "approved";
  const entries = await TimeEntry.find(filter).sort({ startAt: -1 }).lean();
  const byId = new Map(students.map(u => [String(u._id), {
    ...(field === "assignedClient" ? clientStudent(u) : publicStudent(u)),
    approvedMinutes: 0, pendingCount: 0, remainingMinutes: studentRequiredMinutes(u)
  }]));
  for (const entry of entries) {
    const student = byId.get(String(entry.user));
    if (!student) continue;
    if (entry.status === "approved") student.approvedMinutes += entry.minutes;
    if (entry.status === "pending") student.pendingCount += 1;
  }
  for (const item of byId.values()) item.remainingMinutes = Math.max(0, item.requiredMinutes - item.approvedMinutes);
  const allStudents = [...byId.values()];
  res.json({
    students: allStudents,
    studentCount: allStudents.length,
    pendingCount: allStudents.reduce((sum, u) => sum + u.pendingCount, 0),
    approvedMinutes: allStudents.reduce((sum, u) => sum + u.approvedMinutes, 0)
  });
}

teacherRouter.get("/overview", (req, res) => overview(req, res, "assignedTeacher"));
teacherRouter.get("/students", (req, res) => overview(req, res, "assignedTeacher"));
clientRouter.get("/overview", (req, res) => overview(req, res, "assignedClient"));
clientRouter.get("/students", (req, res) => overview(req, res, "assignedClient"));

teacherRouter.get("/students/:id", async (req, res) => {
  const student = await assignedStudent(req, res, "assignedTeacher", req.params.id);
  if (!student) return;
  const [records, schedules] = await Promise.all([
    TimeEntry.find({ user: student._id }).sort({ startAt: -1 }).lean(),
    Schedule.find({ user: student._id }).sort({ dayOfWeek: 1, startTime: 1 }).lean()
  ]);
  const approvedMinutes = records.filter(e => e.status === "approved").reduce((total, e) => total + e.minutes, 0);
  res.json({ student: publicStudent(student), records, schedules, approvedMinutes,
    remainingMinutes: Math.max(0, studentRequiredMinutes(student) - approvedMinutes) });
});

clientRouter.get("/students/:id", async (req, res) => {
  const student = await assignedStudent(req, res, "assignedClient", req.params.id);
  if (!student) return;
  const attendance = await TimeEntry.find({ user: student._id, status: "approved" }).sort({ startAt: -1 }).lean();
  const approvedMinutes = attendance.reduce((sum, item) => sum + item.minutes, 0);
  res.json({ student: clientStudent(student), attendance, approvedMinutes,
    remainingMinutes: Math.max(0, studentRequiredMinutes(student) - approvedMinutes) });
});

teacherRouter.get("/records", async (req, res) => {
  const students = await User.find({ role: "student", active: true, assignedTeacher: req.user._id }).select("_id");
  const records = await TimeEntry.find({ user: { $in: students.map(u => u._id) } })
    .populate("user", "name studentNo").sort({ createdAt: -1 }).limit(250);
  res.json({ records });
});

clientRouter.get("/attendance", async (req, res) => {
  const students = await User.find({ role: "student", active: true, assignedClient: req.user._id }).select("_id");
  const records = await TimeEntry.find({ user: { $in: students.map(u => u._id) }, status: "approved" })
    .populate("user", "name studentNo").sort({ startAt: -1 }).limit(250);
  res.json({ records });
});

teacherRouter.patch("/records/:id/review", async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid record ID." });
  const entry = await TimeEntry.findById(req.params.id);
  if (!entry) return res.status(404).json({ message: "Record not found." });
  if (!await assignedStudent(req, res, "assignedTeacher", objectId(entry.user))) return;
  const body = req.body || {};
  const status = body.status;
  const reason = String(body.reason || "").trim();
  if (!["approved", "rejected"].includes(status) || (status === "rejected" && reason.length < 5)) {
    return res.status(400).json({ message: "Choose approved or rejected; rejected records require a reason." });
  }
  if (entry.status !== "pending") return res.status(409).json({ message: "Only pending records can be reviewed." });
  if (status === "approved") {
    const rows = await TimeEntry.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(entry.user)), status: "approved", _id: { $ne: entry._id } } },
      { $group: { _id: null, minutes: { $sum: "$minutes" } } }
    ]);
    if ((rows[0]?.minutes || 0) + entry.minutes > studentRequiredMinutes(await User.findById(entry.user).lean())) {
      return res.status(400).json({ message: "Approval would exceed this student’s required hours." });
    }
  }
  const updated = await TimeEntry.findOneAndUpdate({ _id: entry._id, status: "pending" },
    { $set: { status, rejectionReason: status === "rejected" ? reason : "", reviewedBy: req.user._id, reviewedAt: new Date() } },
    { new: true, runValidators: true });
  if (!updated) return res.status(409).json({ message: "Record was already reviewed." });
  await auditChange(req.user._id, `Teacher hours ${status}`, String(entry.user),
    recordSnapshot(entry), recordSnapshot(updated), { targetId: entry._id, note: reason });
  res.json({ entry: updated });
});

teacherRouter.get("/evaluations", async (req, res) => {
  const assigned = await User.find({ role: "student", active: true, assignedTeacher: req.user._id }).select("_id");
  const evaluations = await Evaluation.find({ teacher: req.user._id,
    student: { $in: assigned.map(student => student._id) } })
    .populate("student", "name studentNo").sort({ date: -1 }).limit(250);
  res.json({ evaluations });
});

teacherRouter.post("/evaluations", async (req, res) => {
  const body = req.body || {};
  if (!await assignedStudent(req, res, "assignedTeacher", body.studentId)) return;
  const { rating, remarks, date } = body;
  const evaluatedDate = new Date(date);
  if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5 ||
      typeof remarks !== "string" || remarks.trim().length < 10 || remarks.length > 1000 ||
      Number.isNaN(evaluatedDate.getTime())) {
    return res.status(400).json({ message: "Provide a rating from 1–5, remarks (at least 10 characters), and a valid date." });
  }
  const evaluation = await Evaluation.create({ student: body.studentId, teacher: req.user._id,
    rating: Number(rating), remarks: remarks.trim(), date: evaluatedDate });
  res.status(201).json({ evaluation });
});

teacherRouter.get("/requests", async (req, res) => {
  const requests = await AdjustmentRequest.find({ teacher: req.user._id })
    .populate("student", "name studentNo").sort({ createdAt: -1 }).limit(250);
  res.json({ requests });
});

teacherRouter.post("/requests", async (req, res, next) => {
  try {
    const { studentId, targetType, targetId, proposed, reason } = req.body || {};
    if (!await assignedStudent(req, res, "assignedTeacher", studentId)) return;

    const note = typeof reason === "string" ? reason.trim() : "";
    if (!["record", "schedule"].includes(targetType) || !validId(targetId) ||
        note.length < 10 || note.length > 1000 ||
        !proposed || typeof proposed !== "object" || Array.isArray(proposed)) {
      return res.status(400).json({
        message: "Select a record or schedule, provide proposed values, and explain the reason (10–1000 characters)."
      });
    }

    const target = targetType === "record"
      ? await TimeEntry.findById(targetId)
      : await Schedule.findById(targetId);
    if (!target || String(target.user) !== String(studentId)) {
      return res.status(404).json({ message: "Target not found for the selected student." });
    }
    if (targetType === "record" && target.status === "active") {
      return res.status(409).json({ message: "Active sessions cannot be adjusted." });
    }

    const before = targetType === "record" ? recordSnapshot(target) : scheduleSnapshot(target);
    let cleanProposed;

    if (targetType === "record") {
      const requestingHours = proposed.hourOverride === true;
      const hasHours = Object.hasOwn(proposed, "creditedHours");
      if (proposed.hourOverride !== undefined && typeof proposed.hourOverride !== "boolean") {
        return res.status(400).json({ message: "Invalid credited-hours adjustment option." });
      }
      if (requestingHours !== hasHours) {
        return res.status(400).json({
          message: "To request credited hours, enable the override and enter the proposed number of hours."
        });
      }
      if (requestingHours && (
        !["string", "number"].includes(typeof proposed.creditedHours) ||
        String(proposed.creditedHours).trim() === ""
      )) {
        return res.status(400).json({ message: "Enter a valid non-negative number of requested hours." });
      }

      // Keep approval status fixed and use the teacher's request reason as
      // the override reason. No student record is modified by this endpoint.
      cleanProposed = validateAdminRecord({
        ...before, ...proposed,
        status: before.status,
        rejectionReason: before.rejectionReason,
        hourOverride: requestingHours,
        hourAdjustmentReason: requestingHours ? note : ""
      });
    } else {
      cleanProposed = validateSchedule({ ...before, ...proposed }, studentId);
    }

    const adjustmentRequest = await AdjustmentRequest.create({
      student: studentId,
      teacher: req.user._id,
      targetType,
      targetId,
      before,
      proposed: cleanProposed,
      targetUpdatedAt: target.updatedAt,
      reason: note
    });

    return res.status(201).json({ request: adjustmentRequest });
  } catch (error) {
    return handleAdjustmentError(error, res, next);
  }
});

export { teacherRouter, clientRouter };
