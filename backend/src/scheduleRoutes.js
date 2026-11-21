
import { Router } from "express";
import mongoose from "mongoose";
import { User } from "./models.js";
import { Schedule } from "./scheduleModel.js";
import {
  authenticate,
  allowRoles
} from "./middleware/auth.js";
import { validateTimeRange } from "./utils/practrack.js";

const router = Router();

router.use(authenticate);

function cleanSchedule(body) {
  const dayOfWeek = Number(body.dayOfWeek);
  const startTime = String(body.startTime || "");
  const endTime = String(body.endTime || "");
  const subject = String(body.subject || "").trim();

  if (
    !mongoose.isValidObjectId(body.userId) ||
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6 ||
    !validateTimeRange(startTime, endTime) ||
    subject.length < 2 ||
    subject.length > 120
  ) {
    return null;
  }

  return {
    user: body.userId,
    dayOfWeek,
    startTime,
    endTime,
    subject,
    room: String(body.room || "").trim().slice(0, 120),
    instructor: String(body.instructor || "").trim().slice(0, 120)
  };
}

async function hasScheduleOverlap(schedule, excludeId = null) {
  const query = {
    user: schedule.user,
    dayOfWeek: schedule.dayOfWeek,
    startTime: { $lt: schedule.endTime },
    endTime: { $gt: schedule.startTime }
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Boolean(await Schedule.exists(query));
}

router.get("/", async (req, res) => {
  const query = req.user.role === "student"
    ? { user: req.user._id }
    : {};

  const schedules = await Schedule.find(query)
    .populate("user", "name studentNo")
    .sort({
      dayOfWeek: 1,
      startTime: 1,
      user: 1
    });

  res.json({ schedules });
});

router.post(
  "/",
  allowRoles("coordinator", "admin"),
  async (req, res) => {
    const payload = cleanSchedule(req.body);

    if (!payload) {
      return res.status(400).json({
        message: "Invalid schedule details."
      });
    }

    const student = await User.findOne({
      _id: payload.user,
      role: "student",
      active: true
    });

    if (!student) {
      return res.status(404).json({
        message: "Student not found."
      });
    }

    if (await hasScheduleOverlap(payload)) {
      return res.status(409).json({
        message: "This schedule overlaps another assigned session."
      });
    }

    const schedule = await Schedule.create(payload);

    return res.status(201).json({ schedule });
  }
);

router.patch(
  "/:id",
  allowRoles("coordinator", "admin"),
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid schedule ID."
      });
    }

    const payload = cleanSchedule(req.body);

    if (!payload) {
      return res.status(400).json({
        message: "Invalid schedule details."
      });
    }

    const student = await User.findOne({
      _id: payload.user,
      role: "student",
      active: true
    });

    if (!student) {
      return res.status(404).json({
        message: "Student not found."
      });
    }

    const existing = await Schedule.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        message: "Schedule not found."
      });
    }

    if (await hasScheduleOverlap(payload, existing._id)) {
      return res.status(409).json({
        message: "This schedule overlaps another assigned session."
      });
    }

    Object.assign(existing, payload);

    await existing.save();

    return res.json({ schedule: existing });
  }
);

router.delete(
  "/:id",
  allowRoles("coordinator", "admin"),
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid schedule ID."
      });
    }

    const deleted = await Schedule.findByIdAndDelete(
      req.params.id
    );

    if (!deleted) {
      return res.status(404).json({
        message: "Schedule not found."
      });
    }

    return res.json({
      message: "Schedule removed."
    });
  }
);

export default router;
