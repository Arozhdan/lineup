import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { eventSchema } from "@lineup/shared";
import { authRequired, roleRequired, type AuthEnv } from "../auth.js";
import { notifyUsers, rosterUserIds } from "../bot.js";
import { db } from "../db/client.js";
import { games, gameStats, matchEvents, signups, users, type Game } from "../db/schema.js";
import { nowSec, publicUser } from "../lib/serialize.js";
import { statsFromEvents } from "../lib/stats.js";
import { loadGame } from "./games.js";

const idParam = zValidator("param", z.object({ id: z.coerce.number().int().positive() }));

/** Seconds of play, excluding pauses. */
export const matchClock = (g: Game): number => {
  if (!g.startedAt) return 0;
  const end = g.finishedAt ?? nowSec();
  const pausedNow = g.pausedAt && !g.finishedAt ? nowSec() - g.pausedAt : 0;
  return Math.max(0, end - g.startedAt - g.pausedTotal - pausedNow);
};

async function liveState(game: Game) {
  const events = await db.query.matchEvents.findMany({
    where: eq(matchEvents.gameId, game.id),
    orderBy: [matchEvents.createdAt],
  });
  const userIds = [...new Set(events.flatMap((e) => [e.scorerId, e.assistId]).filter((x): x is number => !!x))];
  const players = userIds.length ? await db.query.users.findMany({ where: inArray(users.id, userIds) }) : [];
  const nameOf = new Map(players.map((u) => [u.id, `${u.first} ${u.last}`.trim()]));
  return {
    scoreA: game.scoreA,
    scoreB: game.scoreB,
    startedAt: game.startedAt,
    finishedAt: game.finishedAt,
    paused: !!game.pausedAt,
    clock: matchClock(game),
    events: events
      .map((e) => ({
        id: e.id,
        minute: e.minute,
        team: e.team,
        ownGoal: e.ownGoal,
        scorer: e.scorerId ? (nameOf.get(e.scorerId) ?? "?") : null,
        assist: e.assistId ? (nameOf.get(e.assistId) ?? "?") : null,
      }))
      .reverse(),
  };
}

export const liveRoutes = new Hono<AuthEnv>()
  .use(authRequired)

  /** Live scoreboard state — polled by the UI. Visible to every player. */
  .get("/:id/live", idParam, async (c) => {
    const game = await loadGame(c.req.valid("param").id);
    return c.json(await liveState(game));
  })

  .post("/:id/start", roleRequired("organizer"), idParam, async (c) => {
    const game = await loadGame(c.req.valid("param").id);
    if (game.cancelledAt || game.finishedAt) throw new HTTPException(409, { message: "Игра недоступна" });
    if (game.startedAt) return c.json(await liveState(game));
    await db.update(games).set({ startedAt: nowSec() }).where(eq(games.id, game.id));
    return c.json(await liveState(await loadGame(game.id)));
  })

  .post("/:id/pause", roleRequired("organizer"), idParam, async (c) => {
    const game = await loadGame(c.req.valid("param").id);
    if (!game.startedAt || game.finishedAt) throw new HTTPException(409, { message: "Матч не идёт" });
    if (!game.pausedAt) await db.update(games).set({ pausedAt: nowSec() }).where(eq(games.id, game.id));
    return c.json(await liveState(await loadGame(game.id)));
  })

  .post("/:id/resume", roleRequired("organizer"), idParam, async (c) => {
    const game = await loadGame(c.req.valid("param").id);
    if (game.pausedAt) {
      await db
        .update(games)
        .set({ pausedAt: null, pausedTotal: game.pausedTotal + (nowSec() - game.pausedAt) })
        .where(eq(games.id, game.id));
    }
    return c.json(await liveState(await loadGame(game.id)));
  })

  /** Log a goal: scorer + optional assist, or an own goal. */
  .post("/:id/events", roleRequired("organizer"), idParam, zValidator("json", eventSchema), async (c) => {
    const game = await loadGame(c.req.valid("param").id);
    if (!game.startedAt || game.finishedAt) throw new HTTPException(409, { message: "Матч не идёт" });
    const { team, scorerId, assistId, ownGoal } = c.req.valid("json");
    if (!ownGoal && !scorerId) throw new HTTPException(400, { message: "Укажи автора гола" });
    await db.insert(matchEvents).values({
      gameId: game.id,
      minute: Math.floor(matchClock(game) / 60),
      team,
      scorerId: ownGoal ? null : scorerId,
      assistId: ownGoal ? null : assistId,
      ownGoal,
    });
    await db
      .update(games)
      .set(team === "a" ? { scoreA: game.scoreA + 1 } : { scoreB: game.scoreB + 1 })
      .where(eq(games.id, game.id));
    return c.json(await liveState(await loadGame(game.id)));
  })

  /** Remove a mistaken goal from the timeline (score adjusts). */
  .delete(
    "/:id/events/:eventId",
    roleRequired("organizer"),
    zValidator("param", z.object({ id: z.coerce.number().int().positive(), eventId: z.coerce.number().int().positive() })),
    async (c) => {
      const { id, eventId } = c.req.valid("param");
      const game = await loadGame(id);
      const event = await db.query.matchEvents.findFirst({
        where: and(eq(matchEvents.id, eventId), eq(matchEvents.gameId, game.id)),
      });
      if (!event) throw new HTTPException(404, { message: "Событие не найдено" });
      await db.delete(matchEvents).where(eq(matchEvents.id, event.id));
      await db
        .update(games)
        .set(
          event.team === "a"
            ? { scoreA: Math.max(0, game.scoreA - 1) }
            : { scoreB: Math.max(0, game.scoreB - 1) },
        )
        .where(eq(games.id, game.id));
      return c.json(await liveState(await loadGame(game.id)));
    },
  )

  /** Finish the match: freeze score, derive confirmed stats, notify roster. */
  .post("/:id/finish", roleRequired("organizer"), idParam, async (c) => {
    const game = await loadGame(c.req.valid("param").id);
    if (!game.startedAt) throw new HTTPException(409, { message: "Матч не начат" });
    if (game.finishedAt) return c.json(await liveState(game));

    const pausedTotal = game.pausedAt ? game.pausedTotal + (nowSec() - game.pausedAt) : game.pausedTotal;
    await db.update(games).set({ finishedAt: nowSec(), pausedAt: null, pausedTotal }).where(eq(games.id, game.id));

    // Everyone checked in who wasn't explicitly marked absent counts as attended;
    // confirmed players never checked in are recorded as no-shows.
    const roster = (await db.query.signups.findMany({ where: eq(signups.gameId, game.id) })).filter(
      (s) => s.status === "confirmed",
    );
    for (const s of roster) {
      if (!s.checkedIn) await db.update(signups).set({ noShow: true }).where(eq(signups.id, s.id));
    }

    // Confirmed per-player stats from the event log.
    const events = await db.query.matchEvents.findMany({ where: eq(matchEvents.gameId, game.id) });
    for (const [userId, st] of statsFromEvents(events)) {
      const existing = await db.query.gameStats.findFirst({
        where: and(eq(gameStats.gameId, game.id), eq(gameStats.userId, userId)),
      });
      if (existing) {
        await db
          .update(gameStats)
          .set({ goals: st.goals, assists: st.assists, source: "organizer", confirmed: true })
          .where(eq(gameStats.id, existing.id));
      } else {
        await db.insert(gameStats).values({ gameId: game.id, userId, ...st, source: "organizer", confirmed: true });
      }
    }

    const fresh = await loadGame(game.id);
    const ids = await rosterUserIds(game.id);
    await notifyUsers(
      ids,
      `🏁 <b>${game.title}</b> завершена: Светлые ${fresh.scoreA} – ${fresh.scoreB} Тёмные.\nГолосуй за MVP и отметь свою статистику!`,
      `/#/game/${game.id}/result`,
    );
    return c.json(await liveState(fresh));
  })

  /** Team rosters for the live screen's goal attribution sheet. */
  .get("/:id/teams", idParam, async (c) => {
    const game = await loadGame(c.req.valid("param").id);
    const roster = (await db.query.signups.findMany({ where: eq(signups.gameId, game.id) })).filter(
      (s) => s.status === "confirmed",
    );
    const players = roster.length
      ? await db.query.users.findMany({ where: inArray(users.id, roster.map((s) => s.userId)) })
      : [];
    const byId = new Map(players.map((u) => [u.id, u]));
    const side = (t: "a" | "b") =>
      roster
        .filter((s) => s.team === t)
        .map((s) => ({ ...publicUser(byId.get(s.userId)!), position: s.position }));
    const unassigned = roster.filter((s) => !s.team).map((s) => ({ ...publicUser(byId.get(s.userId)!), position: s.position }));
    return c.json({ a: side("a"), b: side("b"), unassigned });
  });
