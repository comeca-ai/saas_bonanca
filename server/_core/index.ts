import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { seedDatabase } from "../seed";
import { checkDatabaseHealth } from "../db";
import { assertProductionSecrets, ENV } from "./env";

function isTrustedMutationOrigin(req: express.Request) {
  const origin = req.get("origin");
  if (!origin) return true;
  const forwardedHost = String(req.get("x-forwarded-host") ?? req.get("host") ?? "").split(",")[0].trim();
  const forwardedProto = String(req.get("x-forwarded-proto") ?? req.protocol ?? "http").split(",")[0].trim();
  const forwardedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : "";
  return origin === ENV.appOrigin || origin === forwardedOrigin;
}

async function startServer() {
  assertProductionSecrets();
  const app = express();
  app.set("trust proxy", 1);
  const server = createServer(app);
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.get("/api/health", async (_req, res) => {
    const database = await checkDatabaseHealth();
    res.status(database ? 200 : 503).json({ status: database ? "ok" : "degraded", service: "bonanca", database });
  });
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  app.use("/api/trpc", (req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !isTrustedMutationOrigin(req)) {
      res.status(403).json({ error: "Origem não autorizada" });
      return;
    }
    next();
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  await seedDatabase().catch(error => console.warn("[Bonança] Seed skipped:", error instanceof Error ? error.message : error));

  if (process.env.NODE_ENV === "development") await setupVite(app, server);
  else serveStatic(app);

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Bonança listening on port ${port}`));
}

startServer().catch(error => { console.error("[Bonança] Startup failed", error); process.exit(1); });
