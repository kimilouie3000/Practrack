
import {
  describe,
  expect,
  it
} from "vitest";

import request from "supertest";
import app from "../app.js";

describe("Admin API requires authentication", () => {
  it("blocks anonymous overview access", async () => {
    const res = await request(app)
      .get("/api/admin/overview");

    expect(res.status).toBe(401);
  });

  it("blocks anonymous student creation", async () => {
    const res = await request(app)
      .post("/api/admin/students")
      .send({ role: "admin" });

    expect(res.status).toBe(401);
  });

  it("blocks anonymous record edits", async () => {
    const res = await request(app)
      .patch(
        "/api/admin/records/507f191e810c19729de860ea"
      )
      .send({ status: "approved" });

    expect(res.status).toBe(401);
  });
});
