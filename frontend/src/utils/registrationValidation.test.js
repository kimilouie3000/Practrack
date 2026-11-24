import { describe, expect, it } from "vitest";
import { registrationError } from "./registrationValidation";

const valid = {
  name: "Test Student",
  studentNo: "2026-00001",
  email: "student01@practrack.com",
  password: "long-secure-password"
};

describe("student registration validation", () => {
  it("accepts a valid new account", () => {
    expect(registrationError(valid)).toBeNull();
  });

  it("rejects the old eight-character password threshold", () => {
    expect(registrationError({ ...valid, password: "12345678" })).toMatch(/12/);
  });

  it("rejects non-PracTrack email domains", () => {
    expect(registrationError({ ...valid, email: "student@gmail.com" })).toMatch(/practrack.com/);
  });

  it("rejects invalid student numbers", () => {
    expect(registrationError({ ...valid, studentNo: "2026-1234" })).toMatch(/YYYY-NNNNN/);
  });

  it("accepts 12 characters as the minimum", () => {
    expect(registrationError({ ...valid, password: "123456789012" })).toBeNull();
  });
});
