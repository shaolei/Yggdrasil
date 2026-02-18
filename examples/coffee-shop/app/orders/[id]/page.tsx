import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems, products } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Nav } from "../../components/Nav";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  preparing: "Preparing",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.userId, session.user.id)));

  if (!order) notFound();

  const items = await db
    .select({
      productName: products.name,
      size: orderItems.size,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, id));

  return (
    <div className="min-h-screen">
      <Nav session={session} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/orders" className="text-coffee-600 hover:underline">
          ← Back to orders
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-coffee-800">
          Order #{id.slice(0, 8)}
        </h1>
        <div className="mt-4 rounded-lg border border-coffee-200 bg-white p-4">
          <p className="text-sm text-stone-500">
            Status:{" "}
            <span className="font-medium text-stone-700">
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Date:{" "}
            {order.createdAt instanceof Date
              ? order.createdAt.toLocaleString("en-US")
              : new Date(order.createdAt as number).toLocaleString("en-US")}
          </p>
          {order.deliveryAddress && (
            <p className="mt-1 text-sm text-stone-500">
              Address: {order.deliveryAddress}
            </p>
          )}
          {order.notes && (
            <p className="mt-1 text-sm text-stone-500">Notes: {order.notes}</p>
          )}
          <ul className="mt-4 space-y-2 border-t border-stone-200 pt-4">
            {items.map((i, idx) => (
              <li key={idx} className="flex justify-between text-sm">
                <span>
                  {i.productName} {i.size} × {i.quantity}
                </span>
                <span>${(i.unitPrice * i.quantity) / 100}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-stone-200 pt-4 font-semibold">
            Total: ${order.total / 100}
          </p>
        </div>
      </main>
    </div>
  );
}
