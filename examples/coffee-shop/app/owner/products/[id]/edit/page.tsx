import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, categories } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { Nav } from "../../../../components/Nav";
import { ProductForm } from "../../ProductForm";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user?.role !== "owner") redirect("/");

  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) notFound();

  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder));

  return (
    <div className="min-h-screen">
      <Nav session={session} />
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-coffee-800">Edit product</h1>
        <ProductForm categories={cats} product={product} />
      </main>
    </div>
  );
}
