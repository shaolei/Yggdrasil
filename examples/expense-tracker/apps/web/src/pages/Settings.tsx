import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api/client";

export function Settings() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (newPassword !== newPasswordConfirm) {
      setError("Passwords do not match");
      return;
    }
    try {
      await api.put("/users/me/password", {
        currentPassword,
        newPassword,
        newPasswordConfirm,
      });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="page page--narrow">
      <h1>Settings</h1>
      <section className="section">
        <h2 className="section__title">Profile</h2>
        <div className="card card--compact">
          <p style={{ margin: 0 }}>
            Email: <strong>{user?.email ?? "..."}</strong>
          </p>
          <span className={`badge badge--${user?.plan ?? "free"}`} style={{ marginTop: "0.5rem", display: "inline-block" }}>
            {user?.plan ?? "free"}
          </span>
        </div>
      </section>
      <section className="section">
        <h2 className="section__title">Change password</h2>
        <form onSubmit={handleChangePassword}>
          {error && <div className="alert alert--error">{error}</div>}
          {success && <div className="alert alert--success">Password updated</div>}
          <div className="form-group">
            <label className="form-label">Current password</label>
            <input
              type="password"
              className="form-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">New password</label>
            <input
              type="password"
              className="form-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm new password</label>
            <input
              type="password"
              className="form-input"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn--primary">
            Save
          </button>
        </form>
      </section>
      <section className="section">
        <h2 className="section__title">Subscription</h2>
        <div className="card card--compact">
          <p style={{ margin: "0 0 0.5rem" }}>Plan: <strong>{user?.plan ?? "..."}</strong></p>
          <Link to="/settings/subscription" className="btn btn--secondary btn" style={{ padding: "0.375rem 0.75rem" }}>
            Manage subscription
          </Link>
        </div>
      </section>
    </div>
  );
}
