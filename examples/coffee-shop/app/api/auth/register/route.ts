import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) {
      return NextResponse.json(
        { error: "Email is already taken." },
        { status: 400 }
      );
    }
    const hash = await bcrypt.hash(password, 10);
    await db.insert(users).values({
      id: randomUUID(),
      email,
      passwordHash: hash,
      name: name || null,
      role: "customer",
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
