
import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  // null means a recurring weekly schedule; YYYY-MM-DD means a dated session.
  date: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  dayOfWeek: {
    type: Number,
    required: true,
    min: 0,
    max: 6
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  room: {
    type: String,
    default: "",
    trim: true
  },
  instructor: {
    type: String,
    default: "",
    trim: true
  }
}, { timestamps: true });

scheduleSchema.index({
  user: 1,
  dayOfWeek: 1,
  startTime: 1
});

export const Schedule =
  mongoose.models.Schedule ||
  mongoose.model("Schedule", scheduleSchema);