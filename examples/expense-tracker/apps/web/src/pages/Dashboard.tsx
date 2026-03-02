import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface Summary {
  total: number;
  topCategories: Array<{ name: string; total: number; icon: string | null }>;
}

export function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<Array<{ id: number; amount: number; date: string; category_name: string }>>([]);

  useEffect(() => {
    const month = new Date().toISOString().slice(0, 7);
    api.get<Summary>(`/reports/summary?month=${month}`).then(setSummary);
    api.get<typeof recent>(`/expenses?limit=5`).then(setRecent);
  }, []);

  const formatAmount = (n: number) => (n / 100).toFixed(2);

  return (
    <div className="page">
      <div className="toolbar toolbar--between">
        <h1>Dashboard</h1>
        <Link to="/expenses/new" className="btn btn--primary">
          Add expense
        </Link>
      </div>
      {summary && (
        <div className="card">
          <h2>This month</h2>
          <p style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0.5rem 0" }}>
            {formatAmount(summary.total)} USD
          </p>
          {summary.topCategories.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <h3>Top categories</h3>
              <ul className="category-list" style={{ marginTop: "0.5rem" }}>
                {summary.topCategories.map((c) => (
                  <li key={c.name} className="category-list__item">
                    <span className="category-chip">
                      {c.icon} {c.name}
                    </span>
                    <span className="amount">{formatAmount(c.total)} USD</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="card">
        <h2>Recent expenses</h2>
        {recent.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
            No expenses yet. Add your first one!
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th className="amount">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e) => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{e.category_name}</td>
                    <td className="amount">{formatAmount(e.amount)} USD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
