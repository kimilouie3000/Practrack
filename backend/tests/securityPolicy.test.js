
import { describe, expect, it } from "vitest";

import {
  isPracTrackEmail,
  isStrongPassword,
  requiredHours,
  maxCreditedHours
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
