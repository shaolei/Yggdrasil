"use client";

import { useRouter } from "next/navigation";

const TRANSITIONS: Record<string, string> = {
  paid: "preparing",
  preparing: "ready",
  ready: "delivered",
};

export function BaristaActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const next = TRANSITIONS[status];
  const labels: Record<string, string> = {
    paid: "Start",
    preparing: "Ready",
    ready: "Served",
  };

  const handleUpdate = async () => {
    if (!next) return;
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
  };

  if (!next) return null;

  return (
    <button
      onClick={handleUpdate}
      className="rounded bg-coffee-600 px-3 py-1 text-sm text-white hover:bg-coffee-700"
    >
      {labels[status] ?? next}
    </button>
  );
}
