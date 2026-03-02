import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

interface Category {
  id: number;
  name: string;
}

export function AddExpense() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number>(0);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [budgetExceeded, setBudgetExceeded] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Category[]>("/categories").then((list) => setCategories(list));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBudgetExceeded(null);
    const amt = Math.round(parseFloat(amount) * 100);
    if (isNaN(amt) || amt <= 0) {
      setError("Invalid amount");
      return;
    }
    try {
      const res = await api.post<{ id: number; budgetExceeded?: { categoryName: string } }>("/expenses", {
        category_id: categoryId,
        amount: amt,
        date,
        description,
      });
      if (res.budgetExceeded) {
        setBudgetExceeded(`Budget exceeded for ${res.budgetExceeded.categoryName}`);
      }
      setTimeout(() => navigate("/expenses"), res.budgetExceeded ? 2000 : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="page page--narrow">
      <h1>Add expense</h1>
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert--error">{error}</div>}
        {budgetExceeded && <div className="alert alert--warning">{budgetExceeded}</div>}
        <div className="form-group">
          <label className="form-label">Category</label>
          <select
            className="form-select"
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            required
          >
            <option value={0}>Select...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Amount (USD)</label>
          <input
            type="number"
            className="form-input"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input
            type="date"
            className="form-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <input
            type="text"
            className="form-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <button type="submit" className="btn btn--primary">
          Save
        </button>
      </form>
    </div>
  );
}
