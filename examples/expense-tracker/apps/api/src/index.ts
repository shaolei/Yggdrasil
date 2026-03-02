import Fastify from "fastify";
import cors from "@fastify/cors";
import "./db/index.js";
import { authRoutes } from "./routes/auth.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true }));

await app.register(authRoutes);

const port = Number(process.env.PORT) || 3000;
await app.listen({ port, host: "0.0.0.0" });
