import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  locks: new Map(),
  create: vi.fn(),
  deleteOne: vi.fn()
}));

vi.mock("../src/models.js", () => ({
  AttendanceLock: {
    create: state.create,
    deleteOne: state.deleteOne
  }
}));

import { withAttendanceWriteLock } from "../src/attendanceLock.js";

beforeEach(() => {
  state.locks.clear();
  state.create.mockReset();
  state.deleteOne.mockReset();
  state.create.mockImplementation(async lock => {
    if (state.locks.has(String(lock._id))) {
      const error = new Error("duplicate key");
      error.code = 11000;
      throw error;
    }
    state.locks.set(String(lock._id), lock);
    return lock;
  });
  state.deleteOne.mockImplementation(async query => {
    const id = String(query._id);
    const lock = state.locks.get(id);
    if (!lock) return { deletedCount: 0 };
    if (query.expiresAt?.$lte) {
      if (lock.expiresAt <= query.expiresAt.$lte) state.locks.delete(id);
    } else if (query.token === lock.token) {
      state.locks.delete(id);
    }
    return { deletedCount: 1 };
  });
});

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

describe("atomic student attendance write lock", () => {
  it("rejects the second in-flight action for the same student", async () => {
    let release;
    const firstRunning = new Promise(resolve => { release = resolve; });
    const guard = withAttendanceWriteLock(async (_req, res) => {
      await firstRunning;
      res.json({ success: true });
    });

    const req = { user: { _id: "507f191e810c19729de860ea" } };
    const firstRes = response();
    const secondRes = response();
    const next = vi.fn();

    const first = guard(req, firstRes, next);
    // Allow the first lock acquisition to complete before issuing the second.
    await vi.waitFor(() => expect(state.locks.size).toBe(1));
    await guard(req, secondRes, next);
    expect(secondRes.statusCode).toBe(409);
    expect(secondRes.body.message).toMatch(/in progress/i);
    release();
    await first;
    expect(firstRes.body.success).toBe(true);
    expect(state.locks.size).toBe(0);
    expect(next).not.toHaveBeenCalled();
  });

  it("permits another request after a prior lock is released", async () => {
    const req = { user: { _id: "507f191e810c19729de860ea" } };
    const guard = withAttendanceWriteLock(async (_req, res) => res.json({ success: true }));
    await guard(req, response(), vi.fn());
    const res = response();
    await guard(req, res, vi.fn());
    expect(res.body.success).toBe(true);
  });
});
