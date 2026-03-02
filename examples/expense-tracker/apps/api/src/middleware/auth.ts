import type { FastifyRequest, FastifyReply } from "fastify";
import * as authService from "../services/auth.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: { userId: number; email: string; plan: string };
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return reply.status(401).send({ error: "Brak tokenu autoryzacji" });
  }

  try {
    request.user = authService.verifyToken(token);
  } catch {
    return reply.status(401).send({ error: "Nieprawidłowy lub wygasły token" });
  }
}
