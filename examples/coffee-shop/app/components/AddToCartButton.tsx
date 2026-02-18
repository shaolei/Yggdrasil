"use client";

import { useCart } from "@/lib/cart-context";

type Product = {
  id: string;
  name: string;
  priceS: number;
  priceM: number;
  priceL: number;
};

export function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart();

  const handleAdd = (size: "S" | "M" | "L") => {
    const price = size === "S" ? product.priceS : size === "M" ? product.priceM : product.priceL;
    addItem({
      productId: product.id,
      productName: product.name,
      size,
      quantity: 1,
      unitPrice: price,
    });
  };

  return (
    <div className="flex gap-1">
      {(["S", "M", "L"] as const).map((size) => (
        <button
          key={size}
          onClick={() => handleAdd(size)}
          className="rounded bg-coffee-600 px-2 py-1 text-xs text-white hover:bg-coffee-700"
        >
          +{size}
        </button>
      ))}
    </div>
  );
}
