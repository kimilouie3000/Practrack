import { randomUUID } from "node:crypto";
import { AttendanceLock } from "./models.js";

/**
 * Serializes one student's attendance mutations across Node/Render instances.
 * Locks expire after 2 minutes if the process dies mid-request.
 */
export function withAttendanceWriteLock(handler) {
  return async function attendanceGuard(req, res, next) {
    const id = req.user._id;
    const token = randomUUID();
    try {
      // Opportunistic cleanup: MongoDB TTL indexes may not expire immediately.
      await AttendanceLock.deleteOne({ _id: id, expiresAt: { $lte: new Date() } });
      await AttendanceLock.create({
        _id: id,
        token,
        expiresAt: new Date(Date.now() + 2 * 60 * 1000)
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "Another attendance action is in progress. Please retry."
        });
      }
      return next(error);
    }

    try {
      return await handler(req, res, next);
    } catch (error) {
      return next(error);
    } finally {
      try {
        // Never release a replacement lock held by another request.
        await AttendanceLock.deleteOne({ _id: id, token });
      } catch (error) {
        console.error("Could not release attendance lock:", error);
      }
    }
  };
}
