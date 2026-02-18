import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Nav } from "../components/Nav";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  preparing: "Preparing",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/orders");

  const userOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, session.user.id))
    .orderBy(desc(orders.createdAt));

  return (
    <div className="min-h-screen">
      <Nav session={session} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-coffee-800">My orders</h1>
        {userOrders.length === 0 ? (
          <p className="text-stone-600">No orders yet.</p>
        ) : (
          <div className="space-y-3">
            {userOrders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="block rounded-lg border border-coffee-200 bg-white p-4 shadow-xs hover:border-coffee-300"
              >
                <div className="flex justify-between">
                  <span className="font-medium">
                    #{o.id.slice(0, 8)} — ${o.total / 100}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-sm ${
                      o.status === "delivered"
                        ? "bg-green-100 text-green-800"
                        : o.status === "cancelled"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-stone-500">
                  {o.createdAt instanceof Date
                    ? o.createdAt.toLocaleString("en-US")
                    : new Date(o.createdAt as number).toLocaleString("en-US")}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
