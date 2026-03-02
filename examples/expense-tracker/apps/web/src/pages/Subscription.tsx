import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api/client";

export function Subscription() {
  const { user, loadUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      await api.post("/subscriptions/upgrade", {});
      await loadUser();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page--narrow">
      <h1>Subscription</h1>
      <div className="card">
        <p style={{ margin: "0 0 1rem" }}>
          Current plan: <span className={`badge badge--${user?.plan ?? "free"}`}>{user?.plan ?? "..."}</span>
        </p>
        {user?.plan === "free" ? (
          <div>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "1rem" }}>
              Upgrade to Pro for unlimited expenses and categories.
            </p>
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={loading}
              className="btn btn--primary"
            >
              {loading ? "Upgrading..." : "Upgrade to Pro (mock)"}
            </button>
          </div>
        ) : (
          <p style={{ color: "var(--color-accent)", fontWeight: 600 }}>You have Pro plan.</p>
        )}
      </div>
    </div>
  );
}
