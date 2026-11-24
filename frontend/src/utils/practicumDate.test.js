import { describe, expect, it } from "vitest";
import { practicumDate } from "./practicumDate";

describe("PracTrack attendance date uses Asia/Manila", () => {
  it("classifies times near midnight consistently", () => {
    expect(practicumDate("2026-11-24T15:30:00Z")).toBe("2026-11-24");
    expect(practicumDate("2026-11-24T16:30:00Z")).toBe("2026-11-25");
  });
  it("returns empty for invalid dates", () => {
    expect(practicumDate("not-a-date")).toBe("");
  });
});
