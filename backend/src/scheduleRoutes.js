import { Router } from "express";
import mongoose from "mongoose";
import { User } from "./models.js";
import { Schedule } from "./scheduleModel.js";
import { authenticate, allowRoles } from "./middleware/auth.js";
import {
  validateSchedule, checkScheduleRules, scheduleSnapshot,
  applyScheduleEdit, auditChange, handleAdjustmentError
} from "./adjustmentService.js";

const router = Router();
router.use(authenticate);
const validId = id => mongoose.isValidObjectId(id);

router.get("/", async (req, res) => {
  const role = req.user.role;
  let query = {};
  if (role === "student") query.user = req.user._id;
  if (role === "teacher" || role === "client") {
    const assigned = role === "teacher" ? "assignedTeacher" : "assignedClient";
    const students = await User.find({ role: "student", active: true, [assigned]: req.user._id }).select("_id");
    query.user = { $in: students.map(u => u._id) };
  }
  const schedules = await Schedule.find(query).populate("user", "name studentNo")
    .sort({ dayOfWeek: 1, startTime: 1, user: 1 });
  res.json({ schedules });
});

router.post("/", allowRoles("admin"), async (req, res, next) => {
  try {
    const data = validateSchedule(req.body, req.body?.userId);
    await checkScheduleRules(data);
    const schedule = await Schedule.create(data);
    await auditChange(req.user._id, "Schedule created", String(data.user), null,
      scheduleSnapshot(schedule), { targetId: schedule._id });
    res.status(201).json({ schedule });
  } catch (error) { return handleAdjustmentError(error, res, next); }
});

router.patch("/:id", allowRoles("admin"), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid schedule ID." });
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ message: "Schedule not found." });
    if (req.body?.userId && String(req.body.userId) !== String(schedule.user)) {
      return res.status(400).json({ message: "Changing the schedule owner is not allowed." });
    }
    await applyScheduleEdit(schedule, req.body, req.user._id, { action: "Admin schedule edited" });
    res.json({ schedule });
  } catch (error) { return handleAdjustmentError(error, res, next); }
});

router.delete("/:id", allowRoles("admin"), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid schedule ID." });
  const schedule = await Schedule.findById(req.params.id);
  if (!schedule) return res.status(404).json({ message: "Schedule not found." });
  const before = scheduleSnapshot(schedule);
  await Schedule.deleteOne({ _id: schedule._id });
  await auditChange(req.user._id, "Schedule deleted", String(schedule.user), before, null, { targetId: schedule._id });
  res.json({ message: "Schedule removed." });
});

export default router;