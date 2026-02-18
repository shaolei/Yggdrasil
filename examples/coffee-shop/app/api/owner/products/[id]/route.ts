import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user?.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const { name, description, categoryId, priceS, priceM, priceL, available } =
      body;

    await db
      .update(products)
      .set({
        ...(name != null && { name }),
        ...(description !== undefined && { description }),
        ...(categoryId != null && { categoryId }),
        ...(priceS != null && { priceS }),
        ...(priceM != null && { priceM }),
        ...(priceL != null && { priceL }),
        ...(available !== undefined && { available }),
      })
      .where(eq(products.id, id));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
