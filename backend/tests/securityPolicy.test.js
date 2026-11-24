
import { describe, expect, it } from "vitest";

import {
  isPracTrackEmail,
  isStrongPassword,
  requiredHours,
  maxCreditedHours,
  isAccountSessionValid,
  registrationValidationMessage
} from "../src/securityPolicy.js";

describe("Phase 1 account security policy", () => {
  it("accepts PracTrack identifiers only", () => {
    expect(
      isPracTrackEmail("Student01@PracTrack.com")
    ).toBe(true);

    expect(
      isPracTrackEmail("member@gmail.com")
    ).toBe(false);

    expect(
      isPracTrackEmail("not-an-email")
    ).toBe(false);
  });

  it("requires passwords of at least 12 characters", () => {
    expect(isStrongPassword("short123")).toBe(false);

    expect(
      isStrongPassword("a-strong-password-123")
    ).toBe(true);
  });

  it("uses the centralized OJT target", () => {
    expect(requiredHours()).toBeGreaterThan(0);
    expect(maxCreditedHours()).toBeGreaterThan(
      requiredHours()
    );
  });
});

describe("Authentication and registration regression coverage", () => {
  it("rejects old tokens after changing a password", () => {
    const user = { active: true, archivedAt: null, passwordVersion: 2 };
    expect(isAccountSessionValid(user, { ver: 2 })).toBe(true);
    expect(isAccountSessionValid(user, { ver: 1 })).toBe(false);
  });

  it("rejects suspended and archived accounts", () => {
    expect(isAccountSessionValid({ active: false, passwordVersion: 0 }, { ver: 0 })).toBe(false);
    expect(isAccountSessionValid({ active: true, archivedAt: new Date(), passwordVersion: 0 }, { ver: 0 })).toBe(false);
  });

  it("rejects malformed or missing session versions", () => {
    expect(isAccountSessionValid({ active: true, passwordVersion: 0 }, {})).toBe(false);
    expect(isAccountSessionValid({ active: true, passwordVersion: 0 }, { ver: -1 })).toBe(false);
  });

  it("rejects malformed registration fields without throwing", () => {
    expect(registrationValidationMessage({ name: {}, email: [], studentNo: 1, password: {} })).toMatch(/name/i);
    expect(registrationValidationMessage()).toMatch(/name/i);
    expect(registrationValidationMessage({
      name: "Valid Student",
      email: "valid@practrack.com",
      password: "validpassword123",
      studentNo: 123
    })).toMatch(/student number/i);
  });

  it("accepts properly formatted new student registration", () => {
    expect(registrationValidationMessage({
      name: "Valid Student",
      email: "valid@practrack.com",
      password: "validpassword123",
      studentNo: "2026-00001"
    })).toBeNull();
  });
});
