import mongoose from "mongoose";

const evaluationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  remarks: { type: String, trim: true, required: true, maxlength: 1000 },
  date: { type: Date, required: true }
}, { timestamps: true });

const adjustmentRequestSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  targetType: { type: String, enum: ["record", "schedule"], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  // Snapshot and target revision prevent silent approval of a stale request.
  before: { type: mongoose.Schema.Types.Mixed, required: true },
  proposed: { type: mongoose.Schema.Types.Mixed, required: true },
  targetUpdatedAt: { type: Date, required: true },
  reason: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
  decisionNote: { type: String, default: "", maxlength: 1000 },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  decidedAt: { type: Date, default: null }
}, { timestamps: true });

adjustmentRequestSchema.index({ teacher: 1, createdAt: -1 });

export const Evaluation = mongoose.models.Evaluation || mongoose.model("Evaluation", evaluationSchema);
export const AdjustmentRequest = mongoose.models.AdjustmentRequest || mongoose.model("AdjustmentRequest", adjustmentRequestSchema);