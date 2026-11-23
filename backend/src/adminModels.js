
import mongoose from "mongoose";

const adminEventSchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  action: {
    type: String,
    required: true,
    maxlength: 80
  },
  subject: {
    type: String,
    required: true,
    maxlength: 160
  },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  requestId: { type: mongoose.Schema.Types.ObjectId, default: null },
  details: {
    type: String,
    default: "",
    maxlength: 1000
  }
}, { timestamps: true });

adminEventSchema.index({ createdAt: -1 });

export const AdminEvent =
  mongoose.models.AdminEvent ||
  mongoose.model("AdminEvent", adminEventSchema);