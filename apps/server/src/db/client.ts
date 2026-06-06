import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { env } from "../env.js";
import * as schema from "./schema.js";

// Make sure the data directory exists for file: databases.
if (env.databaseUrl.startsWith("file:")) {
  const file = env.databaseUrl.slice("file:".length);
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
}

const client = createClient({ url: env.databaseUrl, authToken: env.databaseAuthToken });

export const db = drizzle(client, { schema });

/** Run committed SQL migrations. Called once on boot. */
export async function runMigrations(): Promise<void> {
  // In dev the folder sits next to src/..; in the built image next to dist/.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../../migrations"), // src/db → apps/server/migrations
    path.resolve(here, "../migrations"), // dist → apps/server/migrations
    path.resolve(process.cwd(), "migrations"),
  ];
  const migrationsFolder = candidates.find((p) => fs.existsSync(p));
  if (!migrationsFolder) throw new Error("migrations folder not found");
  await migrate(db, { migrationsFolder });
}
