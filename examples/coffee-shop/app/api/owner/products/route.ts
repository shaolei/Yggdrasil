import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { randomUUID } from "node:crypto";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user?.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, description, categoryId, priceS, priceM, priceL, available } =
      body;
    if (!name || !categoryId || priceS == null || priceM == null || priceL == null) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const [last] = await db
      .select({ sortOrder: products.sortOrder })
      .from(products)
      .orderBy(products.sortOrder)
      .limit(1);

    await db.insert(products).values({
      id: randomUUID(),
      name,
      description: description ?? null,
      categoryId,
      priceS,
      priceM,
      priceL,
      available: available !== false,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
