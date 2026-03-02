import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db/index.js";
import type { RegisterInput, LoginInput } from "@expense-tracker/shared";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRES = "7d";

export async function register(input: RegisterInput) {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(input.email);
  if (existing) {
    throw new Error("EMAIL_TAKEN");
  }

  const hash = await bcrypt.hash(input.password, 10);
  const result = db
    .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
    .run(input.email, hash);
  const userId = result.lastInsertRowid as number;

  db.prepare("INSERT INTO subscriptions (user_id, plan) VALUES (?, 'free')").run(userId);

  return createToken(userId, input.email, "free");
}

export async function login(input: LoginInput) {
  const user = db
    .prepare(
      "SELECT u.id, u.email, u.password_hash, s.plan FROM users u JOIN subscriptions s ON u.id = s.user_id WHERE u.email = ?"
    )
    .get(input.email) as { id: number; email: string; password_hash: string; plan: string } | undefined;

  if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
    throw new Error("INVALID_CREDENTIALS");
  }

  return createToken(user.id, user.email, user.plan);
}

function createToken(userId: number, email: string, plan: string) {
  return jwt.sign(
    { sub: userId, email, plan },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export function verifyToken(token: string): { userId: number; email: string; plan: string } {
  const decoded = jwt.verify(token, JWT_SECRET) as { sub: number; email: string; plan: string };
  return { userId: decoded.sub, email: decoded.email, plan: decoded.plan };
}
