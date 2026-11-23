
import { Router } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { User, TimeEntry } from "./models.js";
import { Schedule } from "./scheduleModel.js";
import { AdjustmentRequest } from "./portalModels.js";

import {
  authenticate,
  allowRoles
} from "./middleware/auth.js";

import {
  isPracTrackEmail,
  isStrongPassword
} from "./securityPolicy.js";

import {
  applyRecordEdit,
  applyScheduleEdit,
  auditChange,
  recordSnapshot,
  scheduleSnapshot,
  handleAdjustmentError,
  AdjustmentError
} from "./adjustmentService.js";

const router = Router();

router.use(authenticate, allowRoles("admin"));

const validId = id => mongoose.isValidObjectId(id);

const inSession = (query, session) =>
  typeof query?.session === "function"
    ? query.session(session)
    : query;

function cleanAccount(account) {
  return {
    _id: account._id,
    name: account.name,
    email: account.email,
    role: account.role,
    active: account.active,
    company: account.company
  };
}

// ==========================================
// ADMIN - VIEW ACCOUNTS AND ASSIGNMENTS
// ==========================================

router.get("/accounts", async (_req, res) => {
  const accounts = await User.find({
    role: { $in: ["teacher", "client"] }
  })
    .select("name email role active company")
    .sort({ role: 1, name: 1 });

  const students = await User.find({
    role: "student"
  })
    .select(
      "name studentNo assignedTeacher assignedClient active"
    )
    .sort({ name: 1 });

  return res.json({
    accounts,
    students
  });
});

// ==========================================
// ADMIN - CREATE TEACHER OR CLIENT
// ==========================================

router.post("/accounts", async (req, res, next) => {
  const body = req.body || {};

  const name = String(body.name || "").trim();
  const email = String(body.email || "")
    .trim()
    .toLowerCase();

  const password = body.password;
  const role = body.role;

  if (
    !["teacher", "client"].includes(role) ||
    name.length < 2 ||
    name.length > 100 ||
    !isPracTrackEmail(email) ||
    !isStrongPassword(password)
  ) {
    return res.status(400).json({
      message:
        "Enter a valid teacher/client name, @practrack.com email, and password (12–128 characters)."
    });
  }

  try {
    const account = await User.create({
      name,
      email,
      role,
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: true,
      company: String(body.company || "")
        .trim()
        .slice(0, 120)
    });

    await auditChange(
      req.user._id,
      "Account created",
      name,
      null,
      cleanAccount(account),
      { targetId: account._id }
    );

    return res.status(201).json({
      account: cleanAccount(account)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email already exists."
      });
    }

    return next(error);
  }
});

// ==========================================
// ADMIN - RESET ACCOUNT PASSWORD
// ==========================================

router.post(
  "/accounts/:id/reset-password",
  async (req, res, next) => {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid account ID."
      });
    }

    const temporaryPassword =
      req.body?.temporaryPassword;

    if (!isStrongPassword(temporaryPassword)) {
      return res.status(400).json({
        message:
          "Temporary password must contain 12–128 characters."
      });
    }

    try {
      const account = await User.findOne({
        _id: req.params.id,
        role: {
          $in: ["student", "teacher", "client"]
        }
      });

      if (!account) {
        return res.status(404).json({
          message: "Account not found."
        });
      }

      account.passwordHash = await bcrypt.hash(
        temporaryPassword,
        12
      );

      account.passwordVersion =
        Number(account.passwordVersion || 0) + 1;

      account.failedLoginAttempts = 0;
      account.lockedUntil = null;
      account.mustChangePassword = true;

      await account.save();

      await auditChange(
        req.user._id,
        "Account password reset",
        account.name,
        null,
        {
          accountId: account._id,
          mustChangePassword: true
        },
        { targetId: account._id }
      );

      return res.json({
        message:
          "Temporary password applied. Account must change it on next sign-in."
      });
    } catch (error) {
      return next(error);
    }
  }
);

// ==========================================
// ADMIN - ACTIVATE OR DEACTIVATE ACCOUNT
// ==========================================

router.patch("/accounts/:id", async (req, res, next) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid account ID."
    });
  }

  if (typeof req.body?.active !== "boolean") {
    return res.status(400).json({
      message: "Set active to true or false."
    });
  }

  try {
    const account = await User.findOne({
      _id: req.params.id,
      role: { $in: ["teacher", "client"] }
    });

    if (!account) {
      return res.status(404).json({
        message: "Account not found."
      });
    }

    const before = cleanAccount(account);

    account.active = req.body.active;

    await account.save();

    await auditChange(
      req.user._id,
      "Account availability changed",
      account.name,
      before,
      cleanAccount(account),
      { targetId: account._id }
    );

    return res.json({
      account: cleanAccount(account)
    });
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// ADMIN - ASSIGN TEACHER / CLIENT TO STUDENT
// ==========================================

router.patch(
  "/accounts/assignments/:studentId",
  async (req, res, next) => {
    if (!validId(req.params.studentId)) {
      return res.status(400).json({
        message: "Invalid student ID."
      });
    }

    try {
      const student = await User.findOne({
        _id: req.params.studentId,
        role: "student"
      });

      if (!student) {
        return res.status(404).json({
          message: "Student not found."
        });
      }

      const choices = [
        ["assignedTeacher", "teacher"],
        ["assignedClient", "client"]
      ];

      const updated = {};

      for (const [field, role] of choices) {
        const selected = req.body?.[field];

        if (selected === undefined) {
          continue;
        }

        if (selected !== null && selected !== "") {
          if (!validId(selected)) {
            return res.status(400).json({
              message: `Invalid ${role} ID.`
            });
          }

          const account = await User.findOne({
            _id: selected,
            role,
            active: true
          });

          if (!account) {
            return res.status(400).json({
              message: `Selected ${role} is unavailable.`
            });
          }
        }

        updated[field] = selected || null;
      }

      if (!Object.keys(updated).length) {
        return res.status(400).json({
          message:
            "Choose teacher or client assignments."
        });
      }

      const before = {
        assignedTeacher: student.assignedTeacher,
        assignedClient: student.assignedClient
      };

      student.set(updated);

      await student.save();

      await auditChange(
        req.user._id,
        "Student assignments changed",
        student.name,
        before,
        {
          assignedTeacher: student.assignedTeacher,
          assignedClient: student.assignedClient
        },
        { targetId: student._id }
      );

      return res.json({
        student: {
          _id: student._id,
          assignedTeacher: student.assignedTeacher,
          assignedClient: student.assignedClient
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

// ==========================================
// ADMIN - VIEW ADJUSTMENT REQUESTS
// ==========================================

router.get(
  "/adjustment-requests",
  async (_req, res, next) => {
    try {
      const requests = await AdjustmentRequest.find()
        .sort({ createdAt: -1 })
        .limit(250)
        .populate("student", "name studentNo")
        .populate("teacher", "name email");

      return res.json({ requests });
    } catch (error) {
      return next(error);
    }
  }
);

// ==========================================
// ADMIN - APPROVE OR REJECT ADJUSTMENT
// ==========================================

router.patch(
  "/adjustment-requests/:id/decision",
  async (req, res, next) => {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid request ID."
      });
    }

    const status = req.body?.status;

    const decisionNote = String(
      req.body?.note || ""
    ).trim();

    if (
      !["approved", "rejected"].includes(status) ||
      decisionNote.length < 5 ||
      decisionNote.length > 1000
    ) {
      return res.status(400).json({
        message:
          "Select approved/rejected and enter a note of 5–1000 characters."
      });
    }

    // Only an Admin can authorize hours beyond
    // the student's required practicum target.
    const allowOverTarget =
      req.body?.allowOverTarget === true;

    if (
      status === "approved" &&
      allowOverTarget &&
      decisionNote.length < 10
    ) {
      return res.status(400).json({
        message:
          "Over-target approval requires an Admin reason of at least 10 characters."
      });
    }

    let session;

    try {
      session = await mongoose.startSession();

      let decidedRequest;

      // The target update, request decision and audit
      // entries must succeed or fail together.
      await session.withTransaction(async () => {
        const requestQuery = AdjustmentRequest.findById(
          req.params.id
        );

        const adjustment = await inSession(
          requestQuery,
          session
        );

        if (!adjustment) {
          throw new AdjustmentError(
            404,
            "Request not found."
          );
        }

        if (adjustment.status !== "pending") {
          throw new AdjustmentError(
            409,
            "Request already reviewed."
          );
        }

        let after = adjustment.before;

        if (status === "approved") {
          const targetQuery =
            adjustment.targetType === "record"
              ? TimeEntry.findById(adjustment.targetId)
              : Schedule.findById(adjustment.targetId);

          const target = await inSession(
            targetQuery,
            session
          );

          if (
            !target ||
            String(target.user) !==
              String(adjustment.student)
          ) {
            throw new AdjustmentError(
              409,
              "Target was removed or reassigned; request is stale."
            );
          }

          // Prevent approval when the original
          // record changed after the request.
          if (
            new Date(target.updatedAt).getTime() !==
            new Date(
              adjustment.targetUpdatedAt
            ).getTime()
          ) {
            throw new AdjustmentError(
              409,
              "Target changed after the request was made."
            );
          }

          if (adjustment.targetType === "record") {
            const proposed = adjustment.proposed || {};

            const authorizedOverTarget =
              allowOverTarget &&
              proposed.hourOverride === true;

            // Preserve validated Teacher proposals,
            // but only Admin can authorize over-target.
            const values = {
              ...proposed,

              status: target.status,

              rejectionReason:
                target.rejectionReason,

              hourOverride:
                proposed.hourOverride === true,

              allowOverTarget:
                authorizedOverTarget,

              // Admin's reason is used for explicit
              // over-target approvals. Otherwise,
              // preserve the Teacher's justification.
              hourAdjustmentReason:
                authorizedOverTarget
                  ? decisionNote
                  : (
                      proposed.hourAdjustmentReason ||
                      adjustment.reason ||
                      decisionNote
                    )
            };

            const updated = await applyRecordEdit(
              target,
              values,
              req.user._id,
              {
                action:
                  "Teacher request applied to record",
                requestId: adjustment._id,
                note: decisionNote,
                session
              }
            );

            after = recordSnapshot(updated);
          } else if (
            adjustment.targetType === "schedule"
          ) {
            const updated = await applyScheduleEdit(
              target,
              adjustment.proposed,
              req.user._id,
              {
                action:
                  "Teacher request applied to schedule",
                requestId: adjustment._id,
                note: decisionNote,
                session
              }
            );

            after = scheduleSnapshot(updated);
          } else {
            throw new AdjustmentError(
              400,
              "Unsupported adjustment target."
            );
          }
        }

        adjustment.status = status;
        adjustment.decisionNote = decisionNote;
        adjustment.decidedBy = req.user._id;
        adjustment.decidedAt = new Date();

        await adjustment.save({ session });

        await auditChange(
          req.user._id,
          `Adjustment request ${status}`,
          String(adjustment.student),
          adjustment.before,
          after,
          {
            targetId: adjustment.targetId,
            requestId: adjustment._id,
            note: decisionNote,
            session
          }
        );

        decidedRequest = adjustment;
      });

      return res.json({
        request: decidedRequest
      });
    } catch (error) {
      return handleAdjustmentError(
        error,
        res,
        next
      );
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }
);

export default router;
