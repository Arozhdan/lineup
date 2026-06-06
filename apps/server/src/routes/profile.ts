import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { profileSchema, roleOfPosition } from "@lineup/shared";
import { authRequired, type AuthEnv } from "../auth.js";
import { db } from "../db/client.js";
import { games, signups, users } from "../db/schema.js";
import { nowSec, publicUser } from "../lib/serialize.js";
import { activeSeasonData } from "../lib/season.js";

const emptyAgg = (userId: number) => ({
  userId,
  games: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goals: 0,
  assists: 0,
  mvp: 0,
  points: 0,
  form: [] as string[],
  streak: 0,
});

const emptyRel = (userId: number) => ({ userId, signups: 0, attended: 0, lateCancels: 0, noShows: 0, reliability: 100 });

export const profileRoutes = new Hono<AuthEnv>()
  .use(authRequired)

  .get("/me", async (c) => {
    const me = c.get("user");
    const { aggregates, reliability, season } = await activeSeasonData();
    const agg = aggregates.get(me.id) ?? emptyAgg(me.id);
    const rel = reliability.get(me.id) ?? emptyRel(me.id);
    const ranked = [...aggregates.values()].sort((a, b) => b.points - a.points);
    const rank = ranked.findIndex((a) => a.userId === me.id) + 1;
    return c.json({
      ...publicUser(me),
      foot: me.foot,
      area: me.area,
      kitSize: me.kitSize,
      onboarded: !!me.onboardedAt,
      joinedAt: me.createdAt,
      season: season ? { id: season.id, name: season.name } : null,
      stats: { ...agg, reliability: rel.reliability, rank: rank || null },
    });
  })

  /** Save the onboarding wizard / profile edits. */
  .patch("/me", zValidator("json", profileSchema), async (c) => {
    const me = c.get("user");
    const input = c.req.valid("json");
    const [updated] = await db
      .update(users)
      .set({
        first: input.first,
        last: input.last,
        primaryPos: input.primaryPos,
        fallbackPos: input.fallbackPos,
        foot: input.foot,
        level: input.level,
        area: input.area,
        kitSize: input.kitSize,
        onboardedAt: me.onboardedAt ?? nowSec(),
      })
      .where(eq(users.id, me.id))
      .returning();
    return c.json(publicUser(updated!));
  })

  /** Detailed season stats: record, splits by position, reliability detail. */
  .get("/me/stats", async (c) => {
    const me = c.get("user");
    const { aggregates, reliability, season } = await activeSeasonData();
    const agg = aggregates.get(me.id) ?? emptyAgg(me.id);
    const rel = reliability.get(me.id) ?? emptyRel(me.id);

    // Positions actually played, from finished-game signups.
    const mySignups = await db.query.signups.findMany({
      where: and(eq(signups.userId, me.id), eq(signups.status, "confirmed")),
    });
    const gameIds = mySignups.map((s) => s.gameId);
    const myGames = gameIds.length ? await db.query.games.findMany({ where: inArray(games.id, gameIds) }) : [];
    const finishedIds = new Set(myGames.filter((g) => g.finishedAt).map((g) => g.id));
    const posCount = new Map<string, number>();
    for (const s of mySignups) {
      if (!finishedIds.has(s.gameId) || !s.position) continue;
      posCount.set(s.position, (posCount.get(s.position) ?? 0) + 1);
    }
    const totalPos = [...posCount.values()].reduce((a, b) => a + b, 0) || 1;
    const posSplit = [...posCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([code, count]) => ({ code, games: count, pct: Math.round((100 * count) / totalPos), role: roleOfPosition(code) }));

    return c.json({
      season: season?.name ?? null,
      ...agg,
      posSplit,
      reliability: rel,
    });
  })

  /** Public profile of another player. */
  .get("/players/:id", zValidator("param", z.object({ id: z.coerce.number().int().positive() })), async (c) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, c.req.valid("param").id) });
    if (!user) throw new HTTPException(404, { message: "Игрок не найден" });
    const { aggregates, reliability } = await activeSeasonData();
    const agg = aggregates.get(user.id) ?? emptyAgg(user.id);
    const rel = reliability.get(user.id) ?? emptyRel(user.id);
    return c.json({ ...publicUser(user), stats: { ...agg, reliability: rel.reliability } });
  })

  /** Player directory for organizer pickers (add to roster, roles). */
  .get("/players", zValidator("query", z.object({ q: z.string().trim().max(60).default("") })), async (c) => {
    const { q } = c.req.valid("query");
    const all = await db.query.users.findMany();
    const needle = q.toLowerCase();
    const list = (needle ? all.filter((u) => `${u.first} ${u.last} ${u.handle}`.toLowerCase().includes(needle)) : all).slice(0, 50);
    return c.json(list.map(publicUser));
  })

  /** Both leaderboards (points & reliability) for the active season. */
  .get("/leaderboard", async (c) => {
    const me = c.get("user");
    const { aggregates, reliability, season } = await activeSeasonData();
    const userIds = [...new Set([...aggregates.keys(), ...reliability.keys()])];
    const players = userIds.length ? await db.query.users.findMany({ where: inArray(users.id, userIds) }) : [];
    const byId = new Map(players.map((u) => [u.id, u]));

    const points = [...aggregates.values()]
      .filter((a) => byId.has(a.userId) && a.games > 0)
      .sort((a, b) => b.points - a.points)
      .map((a) => ({
        ...publicUser(byId.get(a.userId)!),
        points: a.points,
        games: a.games,
        goals: a.goals,
        mvp: a.mvp,
        you: a.userId === me.id,
      }));
    const rel = [...reliability.values()]
      .filter((r) => byId.has(r.userId) && r.signups > 0)
      .sort((a, b) => b.reliability - a.reliability || b.attended - a.attended)
      .map((r) => ({
        ...publicUser(byId.get(r.userId)!),
        reliability: r.reliability,
        games: r.attended,
        you: r.userId === me.id,
      }));
    return c.json({ season: season?.name ?? null, points, reliability: rel });
  });
