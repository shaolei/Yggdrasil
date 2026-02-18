import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { AddToCartButton } from "./components/AddToCartButton";
import { Nav } from "./components/Nav";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder));
  const prods = await db.select().from(products).where(eq(products.available, true)).orderBy(asc(products.sortOrder));

  const byCategory = cats.map((c) => ({
    ...c,
    products: prods.filter((p) => p.categoryId === c.id),
  }));

  return (
    <div className="min-h-screen">
      <Nav session={session} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold text-coffee-800">Menu</h1>
        {byCategory.map((cat) => (
          <section key={cat.id} className="mb-10">
            <h2 className="mb-4 text-xl font-semibold text-coffee-700">{cat.name}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {cat.products.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col rounded-lg border border-coffee-200 bg-white p-4 shadow-xs"
                >
                  <div className="flex justify-between">
                    <div>
                      <h3 className="font-medium text-coffee-900">{p.name}</h3>
                      {p.description && (
                        <p className="mt-1 text-sm text-stone-600">{p.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-sm text-stone-500">
                      S: ${(p.priceS / 100).toFixed(2)} · M: ${(p.priceM / 100).toFixed(2)} · L:{" "}
                      ${(p.priceL / 100).toFixed(2)}
                    </div>
                    <AddToCartButton
                      product={{
                        id: p.id,
                        name: p.name,
                        priceS: p.priceS,
                        priceM: p.priceM,
                        priceL: p.priceL,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
