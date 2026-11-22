import mongoose from "mongoose";
import { TimeEntry, User } from "./models.js";
import { Schedule } from "./scheduleModel.js";
import { AdminEvent } from "./adminModels.js";
import { validateTimeRange } from "./utils/practrack.js";

import { requiredMinutes, studentRequiredMinutes, maxCreditedHours } from "./securityPolicy.js";
export const REQUIRED_MINUTES = requiredMinutes();
const RECORD_STATUSES = ["pending", "approved", "rejected"];

export class AdjustmentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const invalid = (message) => { throw new AdjustmentError(400, message); };
const conflict = (message) => { throw new AdjustmentError(409, message); };
const notFound = (message) => { throw new AdjustmentError(404, message); };
const inSession = (query, session) => session && typeof query?.session === "function"
  ? query.session(session) : query;
const trim = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

export function localDate(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.PRACTICUM_TIME_ZONE || "Asia/Manila",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const get = type => parts.find(x => x.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Admins can edit past/future times; students' own entries retain their past-only rule.
export function validateAdminRecord(body) {
  if (!body || typeof body !== "object") invalid("Invalid record details.");
  const startAt = new Date(body.startAt);
  const endAt = new Date(body.endAt);
  const durationMinutes = Math.floor((endAt - startAt) / 60000);
  const status = body.status || "pending";
  const description = trim(body.description, 2000);
  const rejectionReason = trim(body.rejectionReason, 300);
  const hourOverride = body.hourOverride === true;
  const hourAdjustmentReason = trim(body.hourAdjustmentReason, 1000);
  const allowOverTarget = body.allowOverTarget === true;

  // Admins may credit any non-negative number of hours. Their credited
  // total can differ from the date/time interval and is explicitly audited.
  // A teacher may propose an adjustment, but cannot apply it directly.
  const creditedHours = Number(
    body.creditedHours ?? (Number(body.minutes) / 60)
  );
  const minutes = hourOverride
    ? Math.round(creditedHours * 60)
    : durationMinutes;

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) ||
      !Number.isSafeInteger(durationMinutes) || durationMinutes < 1 ||
      description.length < 20 || !RECORD_STATUSES.includes(status) ||
      (status === "rejected" && rejectionReason.length < 5)) {
    invalid("Enter valid start/end dates, activities (20+ characters), and status. End must be after start.");
  }

  if (hourOverride && (
      !Number.isFinite(creditedHours) || creditedHours < 0 ||
      !Number.isSafeInteger(minutes) ||
      hourAdjustmentReason.length < 10)) {
    invalid("Set non-negative credited hours and an adjustment reason (10+ characters).");
  }
  if (body.hourOverride !== undefined && typeof body.hourOverride !== "boolean") {
    invalid("Invalid hours override flag.");
  }
  if (hourOverride && creditedHours > maxCreditedHours()) {
    invalid(`Credited hours cannot exceed the configured ${maxCreditedHours()}h safety maximum per entry.`);
  }
  if (body.allowOverTarget !== undefined && typeof body.allowOverTarget !== "boolean") {
    invalid("Invalid over-target flag.");
  }
  if (allowOverTarget && !hourOverride) {
    invalid("Enable a credited-hours override when allowing over-target hours.");
  }
  if (allowOverTarget && hourAdjustmentReason.length < 10) {
    invalid("An over-target override requires a reason of at least 10 characters.");
  }
  if (body.company !== undefined && typeof body.company !== "string") {
    invalid("Invalid company.");
  }

  return {
    startAt, endAt, minutes, date: localDate(startAt), status, description,
    company: trim(body.company, 120),
    rejectionReason: status === "rejected" ? rejectionReason : "",
    hourOverride,
    hourAdjustmentReason: hourOverride ? hourAdjustmentReason : "",
    allowOverTarget
  };
}

export function validateSchedule(body, studentId) {
  if (!body || typeof body !== "object") invalid("Invalid schedule details.");
  const date = body.date ? String(body.date).trim() : null;
  const dateIsValid = !date || (/^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date);
  // For a dated session, weekday follows the date automatically.
  const dayOfWeek = dateIsValid && date
    ? new Date(`${date}T00:00:00Z`).getUTCDay()
    : Number(body.dayOfWeek);
  if (!dateIsValid || !mongoose.isValidObjectId(studentId) || !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 0 || dayOfWeek > 6 ||
      !validateTimeRange(body.startTime, body.endTime) ||
      typeof body.subject !== "string" ||
      body.subject.trim().length < 2 || body.subject.trim().length > 120 ||
      ["room", "instructor"].some(key => body[key] !== undefined && typeof body[key] !== "string")) {
    invalid("Invalid schedule day, time range or subject.");
  }
  return {
    user: studentId, date, dayOfWeek, startTime: body.startTime, endTime: body.endTime,
    subject: body.subject.trim(), room: trim(body.room, 120),
    instructor: trim(body.instructor, 120)
  };
}

export async function checkRecordRules(studentId, data, excludeId = null, session = null) {
  if (!mongoose.isValidObjectId(studentId)) invalid("Invalid student ID.");
  const studentQuery = User.findOne({ _id: studentId, role: "student", active: true });
  const student = await inSession(studentQuery, session);
  if (!student) notFound("Active student not found.");

  if (data.status !== "rejected") {
    const query = {
      user: studentId, status: { $ne: "rejected" },
      startAt: { $lt: data.endAt },
      $or: [{ endAt: null }, { endAt: { $gt: data.startAt } }]
    };
    if (excludeId) query._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };
    const overlap = TimeEntry.exists(query);
    if (await inSession(overlap, session)) conflict("Entry overlaps another attendance record.");
  }

  if (data.status === "approved") {
    const query = { user: new mongoose.Types.ObjectId(String(studentId)), status: "approved" };
    if (excludeId) query._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };
    const aggregate = TimeEntry.aggregate([
      { $match: query },
      { $group: { _id: null, minutes: { $sum: "$minutes" } } }
    ]);
    const totals = await inSession(aggregate, session);
    if ((totals[0]?.minutes || 0) + data.minutes > studentRequiredMinutes(student) && !data.allowOverTarget) {
      conflict("Approval exceeds required hours. Admin must explicitly allow over target with a reason.");
    }
  }
}

export async function checkScheduleRules(data, excludeId = null, session = null) {
  const studentQuery = User.findOne({ _id: data.user, role: "student", active: true });
  const student = await inSession(studentQuery, session);
  if (!student) notFound("Active student not found.");
  const query = {
    user: data.user, dayOfWeek: data.dayOfWeek,
    startTime: { $lt: data.endTime }, endTime: { $gt: data.startTime }
  };
  // Dated sessions conflict with the weekly template and other sessions on that date.
  // A recurring session conflicts with all sessions on the same weekday and time.
  if (data.date) query.$or = [{ date: data.date }, { date: null }];
  if (excludeId) query._id = { $ne: excludeId };
  const overlap = Schedule.exists(query);
  if (await inSession(overlap, session)) conflict("Schedule overlaps another assigned session.");
}

export function recordSnapshot(record) {
  return {
    startAt: record.startAt, endAt: record.endAt, date: record.date,
    minutes: record.minutes, status: record.status, description: record.description,
    company: record.company, rejectionReason: record.rejectionReason,
    hourOverride: record.hourOverride === true,
    hourAdjustmentReason: record.hourAdjustmentReason || "",
    allowOverTarget: record.allowOverTarget === true
  };
}

export function scheduleSnapshot(item) {
  return {
    user: item.user, date: item.date || null, dayOfWeek: item.dayOfWeek, startTime: item.startTime,
    endTime: item.endTime, subject: item.subject, room: item.room, instructor: item.instructor
  };
}

export async function auditChange(actorId, action, subject, before, after, meta = {}) {
  const event = {
    actor: actorId, action, subject: String(subject).slice(0, 160),
    details: String(meta.note || "").slice(0, 1000),
    before: before ?? null, after: after ?? null,
    targetId: meta.targetId || null, requestId: meta.requestId || null
  };
  return meta.session
    ? AdminEvent.create([event], { session: meta.session })
    : AdminEvent.create(event);
}

export async function applyRecordEdit(entry, values, actorId, meta = {}) {
  if (entry.status === "active") conflict("Active sessions cannot be edited.");
  const before = recordSnapshot(entry);
  const data = validateAdminRecord(values);
  await checkRecordRules(entry.user, data, entry._id, meta.session);
  entry.set(data);
  entry.reviewedBy = data.status === "pending" ? null : actorId;
  entry.reviewedAt = data.status === "pending" ? null : new Date();
  await entry.save(meta.session ? { session: meta.session } : undefined);
  await auditChange(actorId, meta.action || "Record adjusted", String(entry.user), before,
    recordSnapshot(entry), {
      ...meta, note: meta.note || data.hourAdjustmentReason,
      targetId: entry._id
    });
  return entry;
}

export async function applyScheduleEdit(item, values, actorId, meta = {}) {
  const before = scheduleSnapshot(item);
  const data = validateSchedule(values, item.user);
  await checkScheduleRules(data, item._id, meta.session);
  item.set(data);
  await item.save(meta.session ? { session: meta.session } : undefined);
  await auditChange(actorId, meta.action || "Schedule adjusted", String(item.user), before,
    scheduleSnapshot(item), { ...meta, targetId: item._id });
  return item;
}

export function handleAdjustmentError(error, res, next) {
  if (error instanceof AdjustmentError) return res.status(error.status).json({ message: error.message });
  return next(error);
}
