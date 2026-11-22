import { describe, expect, it } from "vitest";
import { parseRequiredHours, studentRequiredMinutes } from "../src/securityPolicy.js";

describe("Admin-assigned student required hours", () => {
  it("accepts large targets with no arbitrary upper cap", () => {
    expect(parseRequiredHours("600")).toBe(36000);
    expect(parseRequiredHours("1000000")).toBe(60000000);
  });

  it("rejects zero, negative, malformed and unrepresentable targets", () => {
    for (const value of ["0", "-5", "abc", "Infinity", "0.001"]) {
      expect(parseRequiredHours(value)).toBeUndefined();
    }
  });

  it("uses per-student target and allows clearing it", () => {
    expect(studentRequiredMinutes({ requiredMinutesOverride: 36000 })).toBe(36000);
    expect(parseRequiredHours("")).toBeNull();
  });
});
