
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  studentNo: {
    type: String,
    unique: true,
    sparse: true
  },
  role: {
    type: String,
    enum: ["student", "teacher", "client", "admin"],
    default: "student"
  },
  assignedTeacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  assignedClient: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  company: {
    type: String,
    default: ""
  },
  active: {
    type: Boolean,
    default: true
  },
  archivedAt: { type: Date, default: null },
  // Null = system default. Positive whole minutes = student-specific target.
  requiredMinutesOverride: { type: Number, default: null, min: 1 },
  failedLoginAttempts: { type: Number, default: 0, select: false },
  lockedUntil: { type: Date, default: null, select: false },
  mustChangePassword: { type: Boolean, default: false },
  passwordVersion: { type: Number, default: 0 },
  passwordChangedAt: { type: Date, default: null },
  profile: {
    phone: {
      type: String,
      default: ""
    },
    school: {
      type: String,
      default: ""
    },
    course: {
      type: String,
      default: ""
    },
    yearLevel: {
      type: String,
      default: ""
    },
    section: {
      type: String,
      default: ""
    },
    address: {
      type: String,
      default: ""
    },
    bio: {
      type: String,
      default: ""
    }
  }
}, { timestamps: true });

const timeEntrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  date: {
    type: String,
    required: true,
    index: true
  },
  startAt: {
    type: Date,
    required: true
  },
  endAt: {
    type: Date,
    default: null
  },
  minutes: {
    type: Number,
    default: 0,
    min: 0
  },
  hourOverride: {
    type: Boolean,
    default: false
  },
  hourAdjustmentReason: {
    type: String,
    default: "",
    maxlength: 1000
  },
  allowOverTarget: { type: Boolean, default: false },
  description: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    enum: ["active", "pending", "approved", "rejected"],
    default: "pending",
    index: true
  },
  rejectionReason: {
    type: String,
    default: ""
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

export const User = mongoose.models.User ||
  mongoose.model("User", userSchema);

export const TimeEntry = mongoose.models.TimeEntry ||
  mongoose.model("TimeEntry", timeEntrySchema);

/**
 * A per-student write lock serializes attendance mutations across server instances.
 * The _id (student ID) is unique, preventing parallel overlapping submissions.
 */
const attendanceLockSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true }
}, { versionKey: false });
attendanceLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const AttendanceLock = mongoose.models.AttendanceLock ||
  mongoose.model("AttendanceLock", attendanceLockSchema);
