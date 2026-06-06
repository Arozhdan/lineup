import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { authRequired, type AuthEnv } from "../auth.js";
import { db } from "../db/client.js";
import { photos, users } from "../db/schema.js";
import { env } from "../env.js";
import { loadGame } from "./games.js";

const idParam = zValidator("param", z.object({ id: z.coerce.number().int().positive() }));

export const photoRoutes = new Hono<AuthEnv>()
  .use(authRequired)

  .get("/games/:id/photos", idParam, async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    const list = await db.query.photos.findMany({ where: eq(photos.gameId, game.id) });
    const userIds = [...new Set(list.map((p) => p.userId))];
    const uploaders = userIds.length ? await db.query.users.findMany({ where: inArray(users.id, userIds) }) : [];
    const nameOf = new Map(uploaders.map((u) => [u.id, `${u.first} ${u.last}`.trim()]));
    return c.json(
      list.map((p) => ({
        id: p.id,
        url: p.path,
        by: nameOf.get(p.userId) ?? "?",
        mine: p.userId === me.id,
        createdAt: p.createdAt,
      })),
    );
  })

  .post("/games/:id/photos", idParam, async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!(file instanceof File)) throw new HTTPException(400, { message: "Файл не передан" });
    if (file.size > 10 * 1024 * 1024) throw new HTTPException(400, { message: "Файл больше 10 МБ" });
    const ext = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/heic": ".heic" }[file.type];
    if (!ext) throw new HTTPException(400, { message: "Поддерживаются PNG, JPG, WebP и HEIC" });
    const dir = path.join(env.uploadDir, "games", String(game.id));
    fs.mkdirSync(dir, { recursive: true });
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    const rel = `/uploads/games/${game.id}/${name}`;
    const [created] = await db.insert(photos).values({ gameId: game.id, userId: me.id, path: rel }).returning();
    return c.json({ id: created!.id, url: rel }, 201);
  })

  /** Author or any organizer can remove a photo. */
  .delete("/photos/:id", idParam, async (c) => {
    const me = c.get("user");
    const photo = await db.query.photos.findFirst({ where: eq(photos.id, c.req.valid("param").id) });
    if (!photo) throw new HTTPException(404, { message: "Фото не найдено" });
    if (photo.userId !== me.id && me.role === "player") throw new HTTPException(403, { message: "Нельзя удалить чужое фото" });
    await db.delete(photos).where(eq(photos.id, photo.id));
    const abs = path.join(env.uploadDir, photo.path.replace(/^\/uploads\//, ""));
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
    return c.json({ ok: true });
  });
