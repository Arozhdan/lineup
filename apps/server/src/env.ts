import fs from "node:fs";
import path from "node:path";

// Load the nearest .env (repo root in dev). Real env vars take precedence —
// loadEnvFile does not override already-set variables.
for (const candidate of [".env", "../../.env"]) {
  const p = path.resolve(candidate);
  if (fs.existsSync(p)) {
    process.loadEnvFile(p);
    break;
  }
}

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const env = {
  port: num(process.env.PORT, 3000),
  botToken: process.env.BOT_TOKEN ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "change-me",
  webappUrl: process.env.WEBAPP_URL ?? "http://localhost:5173",
  ownerTgId: Number(process.env.OWNER_TG_ID) || 0,
  databaseUrl: process.env.DATABASE_URL ?? "file:./data/lineup.db",
  databaseAuthToken: process.env.DATABASE_AUTH_TOKEN,
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads"),
  devAuth: process.env.DEV_AUTH === "1",
  /** Directory with the built web app, served statically in production. */
  webDist: process.env.WEB_DIST ?? "",
};
