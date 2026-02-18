import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, categories } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { Nav } from "../../components/Nav";
import { ProductRow } from "./ProductRow";

export default async function OwnerProductsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user?.role !== "owner") redirect("/");

  const prods = await db
    .select()
    .from(products)
    .orderBy(asc(products.sortOrder));
  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder));
  const byCat = Object.fromEntries(cats.map((c) => [c.id, c.name]));

  return (
    <div className="min-h-screen">
      <Nav session={session} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-coffee-800">Products</h1>
          <Link
            href="/owner/products/new"
            className="rounded bg-coffee-600 px-4 py-2 text-white hover:bg-coffee-700"
          >
            + New product
          </Link>
        </div>
        <div className="overflow-x-auto rounded-lg border border-coffee-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-coffee-200 bg-coffee-50">
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Prices (S/M/L)</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {prods.map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  categoryName={byCat[p.categoryId] ?? "—"}
                />
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
