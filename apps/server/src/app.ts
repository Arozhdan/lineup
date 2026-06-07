import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authRoutes } from "./routes/auth.js";
import { gamedayRoutes } from "./routes/gameday.js";
import { groupRoutes } from "./routes/groups.js";
import { gamesRoutes } from "./routes/games.js";
import { liveRoutes } from "./routes/live.js";
import { metaRoutes } from "./routes/meta.js";
import { moneyRoutes } from "./routes/money.js";
import { photoRoutes } from "./routes/photos.js";
import { profileRoutes } from "./routes/profile.js";
import { settingsRoutes } from "./routes/settings.js";
import { signupRoutes } from "./routes/signups.js";
import { teamRoutes } from "./routes/teams.js";

export const api = new Hono()
  .route("/auth", authRoutes)
  .route("/", profileRoutes)
  .route("/groups", groupRoutes)
  .route("/games", gamesRoutes)
  .route("/games", signupRoutes)
  .route("/games", teamRoutes)
  .route("/games", liveRoutes)
  .route("/games", gamedayRoutes)
  .route("/money", moneyRoutes)
  .route("/", photoRoutes)
  .route("/settings", settingsRoutes)
  .route("/", metaRoutes)
  .onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ message: err.message || `Ошибка ${err.status}` }, err.status);
    }
    console.error("[api]", err);
    return c.json({ message: "Внутренняя ошибка сервера" }, 500);
  });

export type AppType = typeof api;
