import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";

interface Category {
  id: number;
  name: string;
}

export function EditExpense() {
  const { id } = useParams<{ id: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number>(0);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Category[]>("/categories").then(setCategories);
  }, []);

  useEffect(() => {
    if (id) {
      api.get<{ category_id: number; amount: number; date: string; description: string | null }>(`/expenses/${id}`).then((e) => {
        setCategoryId(e.category_id);
        setAmount((e.amount / 100).toString());
        setDate(e.date);
        setDescription(e.description ?? "");
      });
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const amt = Math.round(parseFloat(amount) * 100);
    if (isNaN(amt) || amt <= 0) {
      setError("Invalid amount");
      return;
    }
    try {
      await api.put(`/expenses/${id}`, {
        category_id: categoryId,
        amount: amt,
        date,
        description,
      });
      navigate("/expenses");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this expense?")) return;
    await api.delete(`/expenses/${id}`);
    navigate("/expenses");
  };

  return (
    <div className="page page--narrow">
      <h1>Edit expense</h1>
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert--error">{error}</div>}
        <div className="form-group">
          <label className="form-label">Category</label>
          <select
            className="form-select"
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            required
          >
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
          />
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button type="submit" className="btn btn--primary">
            Save
          </button>
          <button type="button" onClick={handleDelete} className="btn btn--danger">
            Delete
          </button>
        </div>
      </form>
    </div>
  );
}
