
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
  details: {
    type: String,
    default: "",
    maxlength: 300
  }
}, { timestamps: true });

adminEventSchema.index({ createdAt: -1 });

export const AdminEvent =
  mongoose.models.AdminEvent ||
  mongoose.model("AdminEvent", adminEventSchema);
