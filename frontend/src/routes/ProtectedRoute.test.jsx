import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute.jsx";
import { roleHome } from "../utils/roleHome.js";

const state = vi.hoisted(() => ({ role: "student" }));
vi.mock("../hooks/useAuth", () => ({ default: () => ({
  user: { role: state.role }, initializing: false, isAuthenticated: true
}) }));

function checkRedirect(role, requestedPath, expected) {
  state.role = role;
  return render(<MemoryRouter initialEntries={[requestedPath]}><Routes>
    <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
      <Route path="/admin" element={<p>Admin only</p>} />
    </Route>
    <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
      <Route path="/dashboard" element={<p>Student page</p>} />
    </Route>
    <Route path="/teacher" element={<p>Teacher home</p>} />
    <Route path="/client" element={<p>Client home</p>} />
  </Routes></MemoryRouter>);
}

describe("role-based navigation", () => {
  it("maps each role to its own dashboard", () => {
    expect(roleHome("admin")).toBe("/admin");
    expect(roleHome("teacher")).toBe("/teacher");
    expect(roleHome("client")).toBe("/client");
    expect(roleHome("student")).toBe("/dashboard");
  });
  it("sends a teacher away from the admin workspace", () => {
    checkRedirect("teacher", "/admin", "Teacher home");
    expect(screen.getByText("Teacher home")).toBeInTheDocument();
  });
  it("sends a client away from student-only pages", () => {
    checkRedirect("client", "/dashboard", "Client home");
    expect(screen.getByText("Client home")).toBeInTheDocument();
  });
});