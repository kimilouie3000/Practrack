
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
    enum: ["student", "coordinator", "admin"],
    default: "student"
  },
  company: {
    type: String,
    default: ""
  },
  active: {
    type: Boolean,
    default: true
  },
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
    default: 0
  },
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
