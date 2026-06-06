import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { issueToken, upsertTelegramUser, validateInitData } from "../auth.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { env } from "../env.js";
import { publicUser } from "../lib/serialize.js";

export const authRoutes = new Hono()
  .post("/telegram", zValidator("json", z.object({ initData: z.string().min(1) })), async (c) => {
    if (!env.botToken) throw new HTTPException(503, { message: "BOT_TOKEN не настроен на сервере" });
    const { initData } = c.req.valid("json");
    const tg = validateInitData(initData, env.botToken);
    const user = await upsertTelegramUser(tg);
    const token = await issueToken(user);
    return c.json({ token, user: publicUser(user), onboarded: !!user.onboardedAt });
  })
  // Development-only login as an arbitrary seeded user.
  .post("/dev", zValidator("json", z.object({ tgId: z.number().int() })), async (c) => {
    if (!env.devAuth) throw new HTTPException(403, { message: "DEV_AUTH выключен" });
    const { tgId } = c.req.valid("json");
    const user = await db.query.users.findFirst({ where: eq(users.tgId, tgId) });
    if (!user) throw new HTTPException(404, { message: "Нет такого пользователя — запусти db:seed" });
    const token = await issueToken(user);
    return c.json({ token, user: publicUser(user), onboarded: !!user.onboardedAt });
  })
  .get("/dev-users", async (c) => {
    if (!env.devAuth) throw new HTTPException(403, { message: "DEV_AUTH выключен" });
    const all = await db.query.users.findMany();
    return c.json(all.map((u) => ({ tgId: u.tgId, name: `${u.first} ${u.last}`.trim(), role: u.role })));
  });
