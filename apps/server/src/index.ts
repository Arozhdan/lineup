import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { api } from "./app.js";
import { startBot, startReminderLoop } from "./bot.js";
import { bootstrap, generateSeriesGames } from "./bootstrap.js";
import { runMigrations } from "./db/client.js";
import { env } from "./env.js";

const app = new Hono();

app.route("/api", api);

// Uploaded photos / QR images.
fs.mkdirSync(env.uploadDir, { recursive: true });
app.use(
  "/uploads/*",
  serveStatic({
    root: path.relative(process.cwd(), env.uploadDir),
    rewriteRequestPath: (p) => p.replace(/^\/uploads/, ""),
  }),
);

// Built web app (production). In dev Vite serves the frontend itself.
if (env.webDist && fs.existsSync(env.webDist)) {
  const root = path.relative(process.cwd(), env.webDist) || ".";
  app.use("/*", serveStatic({ root }));
  app.get("*", serveStatic({ root, path: "index.html" }));
}

await runMigrations();
await bootstrap();
await generateSeriesGames();
setInterval(() => void generateSeriesGames().catch((e) => console.error("[series]", e)), 3600_000);

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`[server] http://localhost:${info.port}`);
});

await startBot();
startReminderLoop();
