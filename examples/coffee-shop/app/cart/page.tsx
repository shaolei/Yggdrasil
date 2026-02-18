"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";

export default function CartPage() {
  const { items, removeItem, updateQuantity, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="mb-4 text-2xl font-bold text-coffee-800">Cart</h1>
        <p className="text-stone-600">Your cart is empty.</p>
        <Link
          href="/"
          className="mt-4 inline-block text-coffee-600 hover:underline"
        >
          Go to menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-coffee-800">Cart</h1>
      <div className="space-y-4">
        {items.map((item, i) => (
          <div
            key={`${item.productId}-${item.size}-${i}`}
            className="flex items-center justify-between rounded-lg border border-coffee-200 bg-white p-4"
          >
            <div>
              <p className="font-medium">{item.productName}</p>
              <p className="text-sm text-stone-500">
                {item.size} × {item.quantity} — ${(item.unitPrice * item.quantity) / 100}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => updateQuantity(i, parseInt(e.target.value, 10) || 1)}
                className="w-14 rounded border border-stone-300 px-2 py-1 text-center"
              />
              <button
                onClick={() => removeItem(i)}
                className="rounded bg-red-100 px-2 py-1 text-sm text-red-700 hover:bg-red-200"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-coffee-200 pt-4">
        <span className="font-semibold">Total: ${total / 100}</span>
        <Link
          href="/checkout"
          className="rounded bg-coffee-600 px-4 py-2 text-white hover:bg-coffee-700"
        >
          Checkout
        </Link>
      </div>
    </div>
  );
}
