import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Follow the repo-root .env so the dev proxy always points at the API's PORT.
const rootEnv = path.resolve(__dirname, "../../.env");
if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const apiPort = process.env.PORT ?? "3000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": `http://localhost:${apiPort}`,
      "/uploads": `http://localhost:${apiPort}`,
    },
  },
});
