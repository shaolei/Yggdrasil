import { Link } from "react-router-dom";

export function Landing() {
  return (
    <div className="landing">
      <h1 className="landing__title">Expense Tracker</h1>
      <p className="landing__subtitle">
        Track your expenses, set budgets, and get insights.
      </p>
      <Link to="/register" className="landing__cta">
        Get started free
      </Link>
      <p className="landing__link">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
