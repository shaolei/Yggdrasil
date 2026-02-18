import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems, payments } from "@/lib/db/schema";
import { createMockPaymentIntent } from "@/lib/stripe-mock";
import { randomUUID } from "node:crypto";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  try {
    const { items, deliveryAddress, notes, paymentMethodId } = await req.json();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty." },
        { status: 400 }
      );
    }

    const total = items.reduce(
      (s: number, i: { unitPrice: number; quantity: number }) =>
        s + i.unitPrice * i.quantity,
      0
    );

    const orderId = randomUUID();

    const pi = createMockPaymentIntent(total, paymentMethodId);
    if (pi.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment failed." },
        { status: 400 }
      );
    }

    await db.insert(orders).values({
      id: orderId,
      userId: session.user.id,
      status: "paid",
      total,
      deliveryAddress: deliveryAddress ?? null,
      notes: notes ?? null,
    });

    for (const item of items) {
      await db.insert(orderItems).values({
        id: randomUUID(),
        orderId,
        productId: item.productId,
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        options: null,
      });
    }

    await db.insert(payments).values({
      id: randomUUID(),
      orderId,
      stripePaymentId: pi.id,
      amount: total,
      status: "succeeded",
    });

    return NextResponse.json({ orderId });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Order failed." },
      { status: 500 }
    );
  }
}
