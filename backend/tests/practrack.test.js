import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";
import {
  isValidStudentNumber,
  validateDailyMinutes,
  validateTotalHours,
  formatHours
} from "../src/utils/practrack.js";

describe("PracTrack backend validation", () => {
  it("B-T1 accepts a correctly formatted student number", () => {
    expect(isValidStudentNumber("2023-04512")).toBe(true);
  });

  it("B-T2 rejects a student number with an invalid format", () => {
    expect(isValidStudentNumber("STUDENT-123")).toBe(false);
  });

  it("B-T3 health route returns HTTP 200 and status ok without database access", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("B-T4 formats a normal practicum duration", () => {
    expect(formatHours(450)).toBe("7h 30m");
  });

  it("B-T5 formats the zero-minute edge case", () => {
    expect(formatHours(0)).toBe("0h 0m");
  });
});

describe("Additional PracTrack rules", () => {
  it("limits a daily entry to twelve hours", () => {
    expect(validateDailyMinutes(12 * 60)).toBe(true);
    expect(validateDailyMinutes(13 * 60)).toBe(false);
  });

  it("does not allow approved hours to exceed the 400-hour requirement", () => {
    expect(validateTotalHours(360 * 60, 40 * 60)).toBe(true);
    expect(validateTotalHours(395 * 60, 10 * 60)).toBe(false);
  });
});
