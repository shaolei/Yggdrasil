"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  priceS: number;
  priceM: number;
  priceL: number;
  available: boolean;
};

export function ProductForm({
  categories,
  product,
}: {
  categories: Category[];
  product?: Product;
}) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? "");
  const [priceS, setPriceS] = useState(String((product?.priceS ?? 0) / 100));
  const [priceM, setPriceM] = useState(String((product?.priceM ?? 0) / 100));
  const [priceL, setPriceL] = useState(String((product?.priceL ?? 0) / 100));
  const [available, setAvailable] = useState(product?.available ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        product ? `/api/owner/products/${product.id}` : "/api/owner/products",
        {
          method: product ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: description || null,
            categoryId,
            priceS: Math.round(parseFloat(priceS) * 100),
            priceM: Math.round(parseFloat(priceM) * 100),
            priceL: Math.round(parseFloat(priceL) * 100),
            available,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Save failed.");
        return;
      }
      router.push("/owner/products");
      router.refresh();
    } catch {
      setError("Connection error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-stone-700">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">Category</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700">Price S ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={priceS}
            onChange={(e) => setPriceS(e.target.value)}
            required
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700">Price M ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={priceM}
            onChange={(e) => setPriceM(e.target.value)}
            required
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700">Price L ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={priceL}
            onChange={(e) => setPriceL(e.target.value)}
            required
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="available"
          checked={available}
          onChange={(e) => setAvailable(e.target.checked)}
        />
        <label htmlFor="available" className="text-sm">
          Available
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-coffee-600 px-4 py-2 text-white hover:bg-coffee-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <Link
          href="/owner/products"
          className="rounded border border-stone-300 px-4 py-2 hover:bg-stone-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
