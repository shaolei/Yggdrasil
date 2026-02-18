import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { sql, desc, gte } from "drizzle-orm";
import { Nav } from "../components/Nav";

export default async function OwnerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user?.role !== "owner") redirect("/");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [todayStats] = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${orders.total}), 0)`,
    })
    .from(orders)
    .where(gte(orders.createdAt, todayStart));

  const [weekStats] = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${orders.total}), 0)`,
    })
    .from(orders)
    .where(gte(orders.createdAt, weekStart));

  const recentOrders = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(10);

  return (
    <div className="min-h-screen">
      <Nav session={session} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-coffee-800">Owner dashboard</h1>
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-coffee-200 bg-white p-4 shadow-xs">
            <h2 className="text-sm font-medium text-stone-500">Today</h2>
            <p className="mt-1 text-2xl font-bold">
              ${(todayStats?.total ?? 0) / 100}
            </p>
            <p className="text-sm text-stone-500">
              {(todayStats?.count ?? 0)} orders
            </p>
          </div>
          <div className="rounded-lg border border-coffee-200 bg-white p-4 shadow-xs">
            <h2 className="text-sm font-medium text-stone-500">Last 7 days</h2>
            <p className="mt-1 text-2xl font-bold">
              ${(weekStats?.total ?? 0) / 100}
            </p>
            <p className="text-sm text-stone-500">
              {(weekStats?.count ?? 0)} orders
            </p>
          </div>
        </div>
        <div className="mb-6 flex gap-4">
          <Link
            href="/owner/products"
            className="rounded bg-coffee-600 px-4 py-2 text-white hover:bg-coffee-700"
          >
            Manage menu
          </Link>
          <Link
            href="/owner/categories"
            className="rounded border border-coffee-300 px-4 py-2 text-coffee-700 hover:bg-coffee-50"
          >
            Categories
          </Link>
        </div>
        <h2 className="mb-4 text-lg font-semibold">Recent orders</h2>
        <div className="space-y-2">
          {recentOrders.map((o) => (
            <div
              key={o.id}
              className="flex justify-between rounded border border-stone-200 bg-white px-4 py-2"
            >
              <span>#{o.id.slice(0, 8)}</span>
              <span>${o.total / 100}</span>
              <span className="text-sm text-stone-500">
                {o.createdAt instanceof Date
                  ? o.createdAt.toLocaleString("en-US")
                  : new Date(o.createdAt as number).toLocaleString("en-US")}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
