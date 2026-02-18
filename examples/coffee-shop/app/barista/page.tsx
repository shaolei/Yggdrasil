import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems, products, users } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { Nav } from "../components/Nav";
import { BaristaActions } from "./BaristaActions";

const STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  preparing: "Preparing",
  ready: "Ready",
  delivered: "Delivered",
};

export default async function BaristaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const role = session.user?.role;
  if (role !== "barista" && role !== "owner") redirect("/");

  const activeOrders = await db
    .select()
    .from(orders)
    .where(
      inArray(orders.status, ["paid", "preparing", "ready"])
    )
    .orderBy(desc(orders.createdAt));

  const ordersWithItems = await Promise.all(
    activeOrders.map(async (o) => {
      const items = await db
        .select({
          productName: products.name,
          size: orderItems.size,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, o.id));
      const [user] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, o.userId));
      return { ...o, items, user };
    })
  );

  return (
    <div className="min-h-screen">
      <Nav session={session} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-coffee-800">Order queue</h1>
        <div className="space-y-4">
          {ordersWithItems.map((o) => (
            <div
              key={o.id}
              className="rounded-lg border border-coffee-200 bg-white p-4 shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">
                    #{o.id.slice(0, 8)} — {o.user?.name ?? o.user?.email ?? "?"}
                  </p>
                  <p className="text-sm text-stone-500">
                    {o.createdAt instanceof Date
                      ? o.createdAt.toLocaleString("en-US")
                      : new Date(o.createdAt as number).toLocaleString("en-US")}
                  </p>
                  {o.notes && (
                    <p className="mt-1 text-sm text-amber-700">Notes: {o.notes}</p>
                  )}
                  <ul className="mt-2 space-y-1 text-sm">
                    {o.items.map((i, idx) => (
                      <li key={idx}>
                        {i.productName} {i.size} × {i.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-sm ${
                      o.status === "ready"
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                  <BaristaActions orderId={o.id} status={o.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
        {ordersWithItems.length === 0 && (
          <p className="text-stone-600">No active orders.</p>
        )}
      </main>
    </div>
  );
}
