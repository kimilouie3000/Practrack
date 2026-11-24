
import mongoose from "mongoose";
import { describe, expect, it, beforeEach, vi } from "vitest";
import request from "supertest";

const state = vi.hoisted(() => ({
  role: "teacher",
  findOne: vi.fn(),
  findRecord: vi.fn(),
  findRequest: vi.fn(),
  makeRequest: vi.fn(),
  audit: vi.fn(),
  exists: vi.fn(),
  aggregate: vi.fn()
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: () => ({
      id: "507f191e810c19729de860ea",
      ver: 0
    }),
    sign: () => "token"
  }
}));

vi.mock("../src/models.js", () => ({
  User: {
    findById: () => ({
      select: async () => ({
        _id: "507f191e810c19729de860ea",
        role: state.role,
        active: true,
        name: "Test user"
      })
    }),
    findOne: state.findOne
  },
  TimeEntry: {
    findById: state.findRecord,
    findOneAndUpdate: vi.fn(),
    exists: state.exists,
    aggregate: state.aggregate
  }
}));

vi.mock("../src/scheduleModel.js", () => ({
  Schedule: {
    findById: vi.fn(),
    exists: vi.fn()
  }
}));

vi.mock("../src/portalModels.js", () => ({
  Evaluation: {},
  AdjustmentRequest: {
    findById: state.findRequest,
    create: state.makeRequest
  }
}));

vi.mock("../src/adminModels.js", () => ({
  AdminEvent: {
    create: state.audit
  }
}));

import app from "../app.js";
import { validateAdminRecord } from "../src/adjustmentService.js";

const recordId = "507f1f77bcf86cd799439011";
const studentId = "507f191e810c19729de861ab";
const token = "Bearer valid-test-token";

const times = {
  startAt: "2034-02-20T01:00:00.000Z",
  endAt: "2034-02-20T03:00:00.000Z",
  description: "Supervised system testing and practicum documentation",
  company: "Example Company",
  status: "pending"
};

beforeEach(() => {
  vi.clearAllMocks();

  vi.spyOn(mongoose, "startSession").mockResolvedValue({
    withTransaction: async fn => fn(),
    endSession: async () => {}
  });

  state.role = "teacher";
  state.findOne.mockResolvedValue(null);
  state.exists.mockResolvedValue(false);
  state.aggregate.mockResolvedValue([]);
  state.audit.mockResolvedValue({});
});

describe("PracTrack v2 permissions", () => {
  it("teacher cannot edit records directly", async () => {
    const result = await request(app)
      .patch(`/api/admin/records/${recordId}`)
      .set("Authorization", token)
      .send(times);

    expect(result.status).toBe(403);
  });

  it("teacher cannot directly modify student schedules", async () => {
    const result = await request(app)
      .patch(`/api/schedule/${recordId}`)
      .set("Authorization", token)
      .send({});

    expect(result.status).toBe(403);
  });

  it("teacher cannot view students who are not assigned", async () => {
    const result = await request(app)
      .get(`/api/teacher/students/${studentId}`)
      .set("Authorization", token);

    expect(result.status).toBe(403);
  });

  it("client cannot view an unassigned student", async () => {
    state.role = "client";

    const result = await request(app)
      .get(`/api/client/students/${studentId}`)
      .set("Authorization", token);

    expect(result.status).toBe(403);
  });

  it("client cannot approve attendance or change schedules", async () => {
    state.role = "client";

    const response = await request(app)
      .patch(`/api/schedule/${recordId}`)
      .set("Authorization", token)
      .send({});

    const review = await request(app)
      .patch(`/api/logs/${recordId}/review`)
      .set("Authorization", token)
      .send({ status: "approved" });

    expect(response.status).toBe(403);
    expect(review.status).toBe(403);
  });

  it("admin validates dates both in the past and future", () => {
    const past = validateAdminRecord({
      ...times,
      startAt: "2020-01-10T01:00:00.000Z",
      endAt: "2020-01-10T03:00:00.000Z"
    });

    const future = validateAdminRecord(times);

    expect(past.minutes).toBe(120);
    expect(future.minutes).toBe(120);
  });

  it("admin record edits accept a past date and a future date", async () => {
    state.role = "admin";

    state.findOne.mockResolvedValue({
      _id: studentId,
      role: "student",
      active: true
    });

    const makeEntry = () => ({
      _id: recordId,
      user: studentId,
      ...times,
      minutes: 120,
      date: "2034-02-20",
      set(values) {
        Object.assign(this, values);
      },
      save: vi.fn().mockResolvedValue(undefined)
    });

    for (const [startAt, endAt] of [
      ["2021-01-10T01:00:00.000Z", "2021-01-10T03:00:00.000Z"],
      ["2034-02-20T01:00:00.000Z", "2034-02-20T03:00:00.000Z"]
    ]) {
      state.findRecord.mockResolvedValue(makeEntry());

      const result = await request(app)
        .patch(`/api/admin/records/${recordId}`)
        .set("Authorization", token)
        .send({
          ...times,
          startAt,
          endAt
        });

      expect(result.status).toBe(200);
    }

    expect(state.audit).toHaveBeenCalledTimes(2);
  });

  it("admin can credit 400 hours without a 12-hour entry cap", async () => {
    state.role = "admin";

    state.findOne.mockResolvedValue({
      _id: studentId,
      role: "student",
      active: true
    });

    const entry = {
      _id: recordId,
      user: studentId,
      ...times,
      minutes: 120,
      date: "2034-02-20",
      set(values) {
        Object.assign(this, values);
      },
      save: vi.fn().mockResolvedValue(undefined)
    };

    state.findRecord.mockResolvedValue(entry);

    const response = await request(app)
      .patch(`/api/admin/records/${recordId}`)
      .set("Authorization", token)
      .send({
        ...times,
        status: "approved",
        hourOverride: true,
        creditedHours: 400,
        hourAdjustmentReason: "Verified approved credit adjustment"
      });

    expect(response.status).toBe(200);
    expect(entry.minutes).toBe(400 * 60);
    expect(entry.hourOverride).toBe(true);
    expect(state.audit).toHaveBeenCalled();
  });

  it("admin accepts a time range beyond 12 hours without a manual override", () => {
    const adjusted = validateAdminRecord({
      ...times,
      startAt: "2034-02-20T01:00:00.000Z",
      endAt: "2034-02-22T01:00:00.000Z"
    });

    expect(adjusted.minutes).toBe(48 * 60);
  });

  it("teacher adjustment request saves the proposed values but not the entry", async () => {
    state.role = "teacher";

    state.findOne.mockResolvedValue({
      _id: studentId,
      role: "student",
      active: true
    });

    state.findRecord.mockResolvedValue({
      _id: recordId,
      user: studentId,
      ...times,
      minutes: 120,
      date: "2034-02-20",
      updatedAt: new Date("2026-01-01")
    });

    state.makeRequest.mockResolvedValue({
      _id: recordId
    });

    const response = await request(app)
      .post("/api/teacher/requests")
      .set("Authorization", token)
      .send({
        studentId,
        targetType: "record",
        targetId: recordId,
        proposed: {
          ...times,
          description: "Requested revised practicum documentation"
        },
        reason: "Incorrect original time entry information"
      });

    expect(response.status).toBe(201);
    expect(state.makeRequest).toHaveBeenCalledOnce();
    expect(state.audit).not.toHaveBeenCalled();
  });

  it("teacher may request 500 credited hours without directly editing the record", async () => {
    state.role = "teacher";

    state.findOne.mockResolvedValue({
      _id: studentId,
      role: "student",
      active: true
    });

    const entry = {
      _id: recordId,
      user: studentId,
      ...times,
      minutes: 120,
      date: "2034-02-20",
      status: "approved",
      updatedAt: new Date("2026-01-01"),
      save: vi.fn()
    };

    state.findRecord.mockResolvedValue(entry);

    state.makeRequest.mockImplementation(async data => ({
      _id: recordId,
      ...data
    }));

    const response = await request(app)
      .post("/api/teacher/requests")
      .set("Authorization", token)
      .send({
        studentId,
        targetType: "record",
        targetId: recordId,
        proposed: {
          ...times,
          hourOverride: true,
          creditedHours: 500
        },
        reason: "Verified by host supervisor and attendance evidence"
      });

    expect(response.status).toBe(201);

    expect(state.makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        proposed: expect.objectContaining({
          hourOverride: true,
          minutes: 500 * 60,
          hourAdjustmentReason:
            "Verified by host supervisor and attendance evidence"
        })
      })
    );

    expect(entry.minutes).toBe(120);
    expect(entry.save).not.toHaveBeenCalled();
  });

  it("teacher cannot request credited hours without enabling the override", async () => {
    state.role = "teacher";

    state.findOne.mockResolvedValue({
      _id: studentId,
      role: "student",
      active: true
    });

    state.findRecord.mockResolvedValue({
      _id: recordId,
      user: studentId,
      ...times,
      minutes: 120,
      status: "pending",
      date: "2034-02-20",
      updatedAt: new Date("2026-01-01")
    });

    const response = await request(app)
      .post("/api/teacher/requests")
      .set("Authorization", token)
      .send({
        studentId,
        targetType: "record",
        targetId: recordId,
        proposed: {
          ...times,
          creditedHours: 500
        },
        reason: "Supervisor approved a revision to the credited hours"
      });

    expect(response.status).toBe(400);
    expect(state.makeRequest).not.toHaveBeenCalled();
  });

  it("admin approval applies requested credited hours and records an audit", async () => {
    state.role = "admin";

    const updatedAt = new Date("2026-01-01T00:00:00Z");

    const entry = {
      _id: recordId,
      user: studentId,
      ...times,
      minutes: 120,
      status: "approved",
      date: "2034-02-20",
      updatedAt,
      set(values) {
        Object.assign(this, values);
      },
      save: vi.fn().mockResolvedValue(undefined)
    };

    state.findRecord.mockResolvedValue(entry);

    state.findOne.mockResolvedValue({
      _id: studentId,
      role: "student",
      active: true
    });

    state.findRequest.mockResolvedValue({
      _id: recordId,
      status: "pending",
      student: studentId,
      targetId: recordId,
      targetType: "record",
      targetUpdatedAt: updatedAt,
      before: {
        minutes: 120
      },
      proposed: {
        ...times,
        status: "approved",
        hourOverride: true,
        minutes: 500 * 60,
        hourAdjustmentReason:
          "Verified by host supervisor and attendance evidence"
      },
      save: vi.fn().mockResolvedValue(undefined)
    });

    const response = await request(app)
      .patch(`/api/admin/adjustment-requests/${recordId}/decision`)
      .set("Authorization", token)
      .send({
        status: "approved",
        allowOverTarget: true,
        note: "Evidence verified by administrator"
      });

    expect(
      response.status,
      `Admin approval failed. API returned ${response.status}: ${JSON.stringify(response.body)}`
    ).toBe(200);

    expect(entry.minutes).toBe(500 * 60);
    expect(entry.hourOverride).toBe(true);
    expect(entry.save).toHaveBeenCalledOnce();
    expect(state.audit).toHaveBeenCalledTimes(2);
  });

  it("admin rejection leaves record unchanged and writes before/after audit", async () => {
    state.role = "admin";

    const save = vi.fn().mockResolvedValue(undefined);

    state.findRequest.mockResolvedValue({
      _id: recordId,
      status: "pending",
      student: studentId,
      targetId: recordId,
      before: {
        minutes: 120
      },
      decisionNote: "",
      save
    });

    const result = await request(app)
      .patch(`/api/admin/adjustment-requests/${recordId}/decision`)
      .set("Authorization", token)
      .send({
        status: "rejected",
        note: "Does not match submitted supporting evidence"
      });

    expect(result.status).toBe(200);
    expect(state.findRecord).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledOnce();
    expect(state.audit).toHaveBeenCalled();
  });

  it("admin approval applies the validated update and audits the decision", async () => {
    state.role = "admin";

    const updatedAt = new Date("2026-01-01T00:00:00Z");

    const entry = {
      _id: recordId,
      user: studentId,
      ...times,
      minutes: 120,
      date: "2034-02-20",
      updatedAt,
      set(values) {
        Object.assign(this, values);
      },
      save: vi.fn().mockResolvedValue(undefined)
    };

    state.findRecord.mockResolvedValue(entry);

    state.findOne.mockResolvedValue({
      _id: studentId,
      role: "student",
      active: true
    });

    state.findRequest.mockResolvedValue({
      _id: recordId,
      status: "pending",
      student: studentId,
      targetId: recordId,
      targetType: "record",
      targetUpdatedAt: updatedAt,
      before: {
        minutes: 120
      },
      proposed: {
        ...times,
        description: "Updated and verified practicum documentation"
      },
      save: vi.fn().mockResolvedValue(undefined)
    });

    const result = await request(app)
      .patch(`/api/admin/adjustment-requests/${recordId}/decision`)
      .set("Authorization", token)
      .send({
        status: "approved",
        note: "Verified against supervisor evidence"
      });

    expect(result.status).toBe(200);
    expect(entry.save).toHaveBeenCalledOnce();
    expect(state.audit).toHaveBeenCalledTimes(2);
  });
});
