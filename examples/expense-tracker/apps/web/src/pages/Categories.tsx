import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Category {
  id: number;
  user_id: number | null;
  name: string;
  icon: string | null;
  color: string | null;
}

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Category[]>("/categories").then(setCategories);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/categories", { name });
      setName("");
      api.get<Category[]>("/categories").then(setCategories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this category?")) return;
    await api.delete(`/categories/${id}`);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const customCategories = categories.filter((c) => c.user_id !== null);

  return (
    <div className="page">
      <h1>Categories</h1>
      <form onSubmit={handleAdd} className="toolbar" style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn--primary">
          Add
        </button>
      </form>
      {error && <div className="alert alert--error">{error}</div>}
      <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>
        Custom categories: {customCategories.length}/5 (Free plan limit)
      </p>
      <div className="card">
        <ul className="category-list">
          {categories.map((c) => (
            <li key={c.id} className="category-list__item">
              <span className="category-chip" style={c.color ? { backgroundColor: `${c.color}20`, color: c.color } : undefined}>
                {c.icon} {c.name}
              </span>
              {c.user_id !== null && (
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="btn btn--danger btn"
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
