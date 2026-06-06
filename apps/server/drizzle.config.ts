import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: undefined,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./data/lineup.db",
  },
});
