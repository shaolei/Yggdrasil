import { useEffect, useState } from "react";
import { api } from "../api/client";

interface ReportRow {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  total: number;
}

export function Reports() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<ReportRow[]>([]);

  useEffect(() => {
    api.get<ReportRow[]>(`/reports?month=${month}`).then(setData);
  }, [month]);

  const total = data.reduce((s, r) => s + r.total, 0);
  const formatAmount = (n: number) => (n / 100).toFixed(2);

  return (
    <div className="page">
      <h1>Reports</h1>
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
              <th>Category</th>
              <th className="amount">Amount</th>
              <th className="amount">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="category-chip" style={r.color ? { backgroundColor: `${r.color}20`, color: r.color } : undefined}>
                    {r.icon} {r.name}
                  </span>
                </td>
                <td className="amount">{formatAmount(r.total)} USD</td>
                <td className="amount">{total > 0 ? ((r.total / total) * 100).toFixed(1) : "0"}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: "1rem", fontWeight: 600, fontSize: "1.125rem" }}>
        Total: {formatAmount(total)} USD
      </p>
    </div>
  );
}
