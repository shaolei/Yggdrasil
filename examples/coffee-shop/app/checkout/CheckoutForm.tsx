"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";

export function CheckoutForm() {
  const router = useRouter();
  const { items, total, clearCart } = useCart();
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          deliveryAddress: address || null,
          notes: notes || null,
          paymentMethodId: cardNumber ? `pm_${cardNumber}` : "pm_mock",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Order failed.");
        return;
      }
      clearCart();
      router.push(`/orders/${data.orderId}`);
      router.refresh();
    } catch {
      setError("Connection error.");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0 && !loading) {
    return (
      <p className="text-stone-600">
        Your cart is empty.{" "}
        <Link href="/" className="text-coffee-600 hover:underline">
          Back to menu
        </Link>
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-stone-700">
          Delivery address or pickup (optional)
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 123 Main St, City"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">
          Order notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">
          Card number (mock — use 4242 4242 4242 4242)
        </label>
        <input
          type="text"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          placeholder="4242 4242 4242 4242"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </div>
      <div className="rounded bg-stone-100 p-4">
        <p className="font-semibold">Total: ${total / 100}</p>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-coffee-600 py-2 text-white hover:bg-coffee-700 disabled:opacity-50"
      >
        {loading ? "Processing..." : "Pay and order"}
      </button>
    </form>
  );
}
