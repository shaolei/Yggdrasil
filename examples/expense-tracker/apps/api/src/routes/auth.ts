import type { FastifyInstance } from "fastify";
import { registerSchema, loginSchema } from "@expense-tracker/shared";
import * as authService from "../services/auth.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Walidacja nie powiodła się",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const token = await authService.register(parsed.data);
      return reply.status(201).send({ token });
    } catch (err) {
      if (err instanceof Error && err.message === "EMAIL_TAKEN") {
        return reply.status(409).send({ error: "Ten adres email jest już używany" });
      }
      throw err;
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Walidacja nie powiodła się",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const token = await authService.login(parsed.data);
      return reply.send({ token });
    } catch (err) {
      if (err instanceof Error && err.message === "INVALID_CREDENTIALS") {
        return reply.status(401).send({ error: "Nieprawidłowy email lub hasło" });
      }
      throw err;
    }
  });
}
