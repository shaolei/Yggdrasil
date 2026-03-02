import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Category {
  id: number;
  name: string;
}

interface BudgetRow {
  category_id: number;
  category_name: string;
  limit_amount: number;
  current_total: number;
}

export function Budgets() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    api.get<Category[]>("/categories").then(setCategories);
  }, []);

  useEffect(() => {
    api.get<BudgetRow[]>(`/budgets?month=${month}`).then(setBudgets);
  }, [month]);

  const handleSave = async (categoryId: number, limitAmount: number) => {
    await api.put("/budgets", { category_id: categoryId, month, limit_amount: limitAmount });
    api.get<BudgetRow[]>(`/budgets?month=${month}`).then(setBudgets);
  };

  const formatAmount = (n: number) => (n / 100).toFixed(2);

  const budgetByCategory = budgetMap(budgets);

  return (
    <div className="page">
      <h1>Budgets</h1>
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
              <th className="amount">Spent</th>
              <th>Limit</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const b = budgetByCategory.get(c.id);
              return (
                <BudgetRow
                  key={c.id}
                  category={c}
                  budget={b}
                  onSave={handleSave}
                  formatAmount={formatAmount}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function budgetMap(budgets: BudgetRow[]) {
  const m = new Map<number, BudgetRow>();
  for (const b of budgets) {
    m.set(b.category_id, b);
  }
  return m;
}

function BudgetRow({
  category,
  budget,
  onSave,
  formatAmount,
}: {
  category: Category;
  budget?: BudgetRow;
  onSave: (categoryId: number, limitAmount: number) => void;
  formatAmount: (n: number) => string;
}) {
  const [limit, setLimit] = useState(budget ? (budget.limit_amount / 100).toString() : "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.round(parseFloat(limit) * 100);
    if (!isNaN(amt) && amt >= 0) {
      onSave(category.id, amt);
    }
  };

  const isOver = budget && budget.current_total > budget.limit_amount;

  return (
    <tr>
      <td>{category.name}</td>
      <td className="amount" style={isOver ? { color: "var(--color-danger)" } : undefined}>
        {budget ? formatAmount(budget.current_total) : "0"} USD
      </td>
      <td>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <input
            type="number"
            className="form-input"
            step="0.01"
            min="0"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Limit"
            style={{ width: "100px" }}
          />
          <button type="submit" className="btn btn--secondary btn" style={{ padding: "0.375rem 0.75rem" }}>
            Save
          </button>
        </form>
      </td>
    </tr>
  );
}
