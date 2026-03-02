import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface Expense {
  id: number;
  amount: number;
  date: string;
  description: string | null;
  category_name: string;
}

export function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    api.get<Expense[]>(`/expenses?month=${month}`).then(setExpenses);
  }, [month]);

  const formatAmount = (n: number) => (n / 100).toFixed(2);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this expense?")) return;
    await api.delete(`/expenses/${id}`);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="page">
      <div className="toolbar toolbar--between">
        <h1>Expenses</h1>
        <Link to="/expenses/new" className="btn btn--primary">
          Add expense
        </Link>
      </div>
      <div className="toolbar">
        <label className="form-label" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          Month:
          <input
            type="month"
            className="form-input"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ width: "auto" }}
          />
        </label>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th className="amount">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td>{e.category_name}</td>
                <td>{e.description ?? ""}</td>
                <td className="amount">{formatAmount(e.amount)} USD</td>
                <td style={{ textAlign: "right" }}>
                  <span style={{ display: "inline-flex", gap: "0.5rem" }}>
                    <Link to={`/expenses/${e.id}/edit`} className="btn btn--ghost btn" style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}>
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(e.id)}
                      className="btn btn--danger btn"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                    >
                      Delete
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
