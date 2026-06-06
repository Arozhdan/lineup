import { createHmac } from "node:crypto";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { sign, verify } from "hono/jwt";
import { eq } from "drizzle-orm";
import type { UserRole } from "@lineup/shared";
import { db } from "./db/client.js";
import { users, type User } from "./db/schema.js";
import { env } from "./env.js";

export type AuthEnv = { Variables: { user: User } };

export type TgInitUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

/**
 * Validate Telegram Mini App initData (HMAC-SHA256 per Telegram docs)
 * and return the embedded user. Throws on tampering or stale data.
 */
export function validateInitData(initData: string, botToken: string): TgInitUser {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new HTTPException(401, { message: "initData: hash missing" });
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (expected !== hash) throw new HTTPException(401, { message: "initData: bad signature" });

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > 24 * 3600) {
    throw new HTTPException(401, { message: "initData: expired" });
  }

  const rawUser = params.get("user");
  if (!rawUser) throw new HTTPException(401, { message: "initData: user missing" });
  return JSON.parse(rawUser) as TgInitUser;
}

/** Find or create a user from a Telegram identity; owner is assigned by env. */
export async function upsertTelegramUser(tg: TgInitUser): Promise<User> {
  const existing = await db.query.users.findFirst({ where: eq(users.tgId, tg.id) });
  if (existing) {
    // Keep Telegram identity fields fresh.
    const [updated] = await db
      .update(users)
      .set({
        handle: tg.username ? `@${tg.username}` : existing.handle,
        photoUrl: tg.photo_url ?? existing.photoUrl,
        ...(existing.onboardedAt ? {} : { first: tg.first_name ?? existing.first, last: tg.last_name ?? existing.last }),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated!;
  }
  const role: UserRole = env.ownerTgId && tg.id === env.ownerTgId ? "owner" : "player";
  const [created] = await db
    .insert(users)
    .values({
      tgId: tg.id,
      first: tg.first_name ?? "",
      last: tg.last_name ?? "",
      handle: tg.username ? `@${tg.username}` : "",
      photoUrl: tg.photo_url ?? "",
      role,
    })
    .returning();
  return created!;
}

export async function issueToken(user: User): Promise<string> {
  return sign({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600 }, env.jwtSecret);
}

/** Requires a valid Bearer token; puts the fresh user row on context. */
export const authRequired = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HTTPException(401, { message: "Не авторизован" });
  let payload: Awaited<ReturnType<typeof verify>>;
  try {
    payload = await verify(token, env.jwtSecret, "HS256");
  } catch {
    throw new HTTPException(401, { message: "Сессия истекла" });
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, Number(payload.sub)) });
  if (!user) throw new HTTPException(401, { message: "Пользователь не найден" });
  c.set("user", user);
  await next();
});

const ROLE_RANK: Record<UserRole, number> = { player: 0, organizer: 1, owner: 2 };

export const roleRequired = (min: UserRole) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.get("user");
    if (ROLE_RANK[user.role] < ROLE_RANK[min]) {
      throw new HTTPException(403, { message: "Недостаточно прав" });
    }
    await next();
  });

export const currentUser = (c: Context<AuthEnv>): User => c.get("user");
