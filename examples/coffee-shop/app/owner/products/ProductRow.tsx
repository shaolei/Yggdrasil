"use client";

import Link from "next/link";

type Product = {
  id: string;
  name: string;
  available: boolean;
  priceS: number;
  priceM: number;
  priceL: number;
};

export function ProductRow({
  product,
  categoryName,
}: {
  product: Product;
  categoryName: string;
}) {
  return (
    <tr className="border-b border-stone-100">
      <td className="px-4 py-2">{product.name}</td>
      <td className="px-4 py-2">{categoryName}</td>
      <td className="px-4 py-2 text-sm">
        ${product.priceS / 100} / ${product.priceM / 100} / ${product.priceL / 100}
      </td>
      <td className="px-4 py-2">
        <span
          className={`rounded px-2 py-0.5 text-sm ${
            product.available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {product.available ? "Available" : "Unavailable"}
        </span>
      </td>
      <td className="px-4 py-2">
        <Link
          href={`/owner/products/${product.id}/edit`}
          className="text-coffee-600 hover:underline"
        >
          Edit
        </Link>
      </td>
    </tr>
  );
}
