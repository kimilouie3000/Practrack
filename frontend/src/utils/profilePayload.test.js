import { describe, expect, it } from "vitest";
import { profileUpdatePayload } from "./profilePayload";

const form = {
  name: "Registered Student",
  company: "Host Company",
  school: "IDSC",
  course: "BS Information Technology",
  yearLevel: "4th Year",
  phone: "09123456789"
};

describe("profile onboarding payload", () => {
  it("lets students complete their profile without protected identity fields", () => {
    expect(profileUpdatePayload(form, "student")).toEqual({
      school: "IDSC",
      course: "BS Information Technology",
      yearLevel: "4th Year",
      phone: "09123456789"
    });
  });

  it("retains protected fields for administrators", () => {
    expect(profileUpdatePayload(form, "admin")).toEqual(form);
  });
});
