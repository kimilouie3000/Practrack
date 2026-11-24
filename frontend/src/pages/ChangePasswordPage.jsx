import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import useAuth from "../hooks/useAuth";
import { apiRequest } from "../api/client";
import { roleHome } from "../utils/roleHome";

export default function ChangePasswordPage() {
  const { user, token, logout, updateSession } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user?.mustChangePassword) {
    return <Navigate to={roleHome(user?.role)} replace />;
  }

  async function submit(event) {
    event.preventDefault();
    if (newPassword.length < 12 || newPassword.length > 128) {
      toast.error("Use a new password of 12–128 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const session = await apiRequest(
        "/auth/change-password",
        { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) },
        token
      );
      updateSession(session);
      toast.success("Password updated. Your temporary password is no longer valid.");
      navigate(roleHome(session.user.role), { replace: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-shell" style={{ display: "flex", justifyContent: "center" }}>
        <form className="auth-form panel" onSubmit={submit} style={{ width: "min(100%, 480px)" }}>
          <span className="eyebrow">ACCOUNT SECURITY</span>
          <h2>Change your temporary password</h2>
          <p className="subtle">Before using PracTrack, choose a private password with at least 12 characters.</p>
          <label className="field">Temporary password
            <input type="password" autoComplete="current-password" required value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)} />
          </label>
          <label className="field">New password
            <input type="password" autoComplete="new-password" required minLength={12} maxLength={128}
              value={newPassword} onChange={event => setNewPassword(event.target.value)} />
          </label>
          <label className="field">Confirm new password
            <input type="password" autoComplete="new-password" required minLength={12} maxLength={128}
              value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? "Updating..." : "Save new password"}
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => { logout(); navigate("/login", { replace: true }); }}>
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
