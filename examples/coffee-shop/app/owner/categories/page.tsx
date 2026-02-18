import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { Nav } from "../../components/Nav";

export default async function OwnerCategoriesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user?.role !== "owner") redirect("/");

  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder));

  return (
    <div className="min-h-screen">
      <Nav session={session} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-coffee-800">Categories</h1>
        <div className="space-y-2">
          {cats.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded border border-stone-200 bg-white px-4 py-2"
            >
              <span>{c.name}</span>
              <span className="text-sm text-stone-500">Order: {c.sortOrder}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
