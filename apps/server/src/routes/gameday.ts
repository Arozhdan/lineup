import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { batchStatsSchema } from "@lineup/shared";
import { authRequired, roleRequired, type AuthEnv } from "../auth.js";
import { db } from "../db/client.js";
import { gameStats, mvpVotes, signups, users } from "../db/schema.js";
import { nowSec, publicUser } from "../lib/serialize.js";
import { mvpWinners } from "../lib/stats.js";
import { loadGame } from "./games.js";

const idParam = zValidator("param", z.object({ id: z.coerce.number().int().positive() }));

const confirmedRoster = async (gameId: number) => {
  const all = await db.query.signups.findMany({ where: eq(signups.gameId, gameId) });
  return all.filter((s) => s.status === "confirmed");
};

export const gamedayRoutes = new Hono<AuthEnv>()
  .use(authRequired)

  /** Toggle a player's check-in (organizer marks who showed up). */
  .post(
    "/:id/checkin",
    roleRequired("organizer"),
    idParam,
    zValidator("json", z.object({ userId: z.number().int().positive(), present: z.boolean() })),
    async (c) => {
      const game = await loadGame(c.req.valid("param").id);
      const { userId, present } = c.req.valid("json");
      const target = await db.query.signups.findFirst({
        where: and(eq(signups.gameId, game.id), eq(signups.userId, userId)),
      });
      if (!target || target.status !== "confirmed") throw new HTTPException(404, { message: "Игрок не в составе" });
      await db.update(signups).set({ checkedIn: present, noShow: false }).where(eq(signups.id, target.id));
      return c.json({ ok: true });
    },
  )

  /**
   * Batch goal/assist entry. Organizer edits the whole roster (confirmed);
   * a player may only self-report their own row (unconfirmed until reviewed).
   */
  .post("/:id/stats", idParam, zValidator("json", batchStatsSchema), async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    if (!game.finishedAt) throw new HTTPException(409, { message: "Матч ещё не завершён" });
    const { rows } = c.req.valid("json");
    const isOrganizer = me.role !== "player";

    if (!isOrganizer) {
      if (rows.length !== 1 || rows[0]!.userId !== me.id) {
        throw new HTTPException(403, { message: "Можно отметить только свои голы и пасы" });
      }
    }
    const roster = await confirmedRoster(game.id);
    const rosterIds = new Set(roster.map((s) => s.userId));
    for (const row of rows) {
      if (!rosterIds.has(row.userId)) throw new HTTPException(400, { message: "Игрок не в составе матча" });
      const existing = await db.query.gameStats.findFirst({
        where: and(eq(gameStats.gameId, game.id), eq(gameStats.userId, row.userId)),
      });
      if (!isOrganizer && existing?.confirmed) {
        throw new HTTPException(409, { message: "Статистику уже подтвердил организатор" });
      }
      const values = {
        goals: row.goals,
        assists: row.assists,
        source: isOrganizer ? ("organizer" as const) : ("self" as const),
        confirmed: isOrganizer,
      };
      if (existing) await db.update(gameStats).set(values).where(eq(gameStats.id, existing.id));
      else await db.insert(gameStats).values({ gameId: game.id, userId: row.userId, ...values });
    }
    return c.json({ ok: true });
  })

  /** Stat rows for the batch screen (role-scoped). */
  .get("/:id/stats", idParam, async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    const roster = await confirmedRoster(game.id);
    const scoped = me.role === "player" ? roster.filter((s) => s.userId === me.id) : roster;
    const players = scoped.length
      ? await db.query.users.findMany({ where: inArray(users.id, scoped.map((s) => s.userId)) })
      : [];
    const byId = new Map(players.map((u) => [u.id, u]));
    const stats = await db.query.gameStats.findMany({ where: eq(gameStats.gameId, game.id) });
    const statOf = new Map(stats.map((s) => [s.userId, s]));
    return c.json(
      scoped.map((s) => {
        const st = statOf.get(s.userId);
        return {
          ...publicUser(byId.get(s.userId)!),
          position: s.position,
          goals: st?.goals ?? 0,
          assists: st?.assists ?? 0,
          confirmed: st?.confirmed ?? false,
        };
      }),
    );
  })

  /** Match result summary: score, MVP, top performers. */
  .get("/:id/result", idParam, async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    const roster = await confirmedRoster(game.id);
    const players = roster.length
      ? await db.query.users.findMany({ where: inArray(users.id, roster.map((s) => s.userId)) })
      : [];
    const byId = new Map(players.map((u) => [u.id, u]));
    const stats = await db.query.gameStats.findMany({
      where: and(eq(gameStats.gameId, game.id), eq(gameStats.confirmed, true)),
    });
    const votes = await db.query.mvpVotes.findMany({ where: eq(mvpVotes.gameId, game.id) });
    const mvpId = mvpWinners(votes).get(game.id) ?? null;
    const mvpUser = mvpId ? byId.get(mvpId) : null;
    const mvpStat = stats.find((s) => s.userId === mvpId);

    const top = [...stats]
      .sort((a, b) => b.goals * 2 + b.assists - (a.goals * 2 + a.assists))
      .slice(0, 5)
      .filter((s) => s.goals + s.assists > 0 && byId.has(s.userId))
      .map((s) => ({ ...publicUser(byId.get(s.userId)!), goals: s.goals, assists: s.assists }));

    const voteWindowOpen = !!game.finishedAt && nowSec() - game.finishedAt < 24 * 3600;
    return c.json({
      id: game.id,
      title: game.title,
      startsAt: game.startsAt,
      scoreA: game.scoreA,
      scoreB: game.scoreB,
      finishedAt: game.finishedAt,
      myTeam: roster.find((s) => s.userId === me.id)?.team ?? null,
      mvp: mvpUser ? { ...publicUser(mvpUser), goals: mvpStat?.goals ?? 0, assists: mvpStat?.assists ?? 0 } : null,
      top,
      votes: votes.length,
      myVote: votes.find((v) => v.voterId === me.id)?.voteeId ?? null,
      voteWindowOpen,
    });
  })

  /** MVP nominees: confirmed roster minus me. */
  .get("/:id/mvp", idParam, async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    const roster = (await confirmedRoster(game.id)).filter((s) => s.userId !== me.id);
    const players = roster.length
      ? await db.query.users.findMany({ where: inArray(users.id, roster.map((s) => s.userId)) })
      : [];
    const byId = new Map(players.map((u) => [u.id, u]));
    const votes = await db.query.mvpVotes.findMany({ where: eq(mvpVotes.gameId, game.id) });
    return c.json({
      nominees: roster.filter((s) => byId.has(s.userId)).map((s) => ({ ...publicUser(byId.get(s.userId)!), position: s.position })),
      myVote: votes.find((v) => v.voterId === me.id)?.voteeId ?? null,
    });
  })

  /** Cast (or change) my MVP vote. Anonymous, no self-votes, 24h window. */
  .post(
    "/:id/mvp",
    idParam,
    zValidator("json", z.object({ voteeId: z.number().int().positive() })),
    async (c) => {
      const me = c.get("user");
      const game = await loadGame(c.req.valid("param").id);
      if (!game.finishedAt) throw new HTTPException(409, { message: "Матч ещё не завершён" });
      if (nowSec() - game.finishedAt > 24 * 3600) throw new HTTPException(409, { message: "Голосование закрыто (24 ч)" });
      const { voteeId } = c.req.valid("json");
      if (voteeId === me.id) throw new HTTPException(400, { message: "За себя голосовать нельзя" });
      const roster = await confirmedRoster(game.id);
      if (!roster.some((s) => s.userId === voteeId)) throw new HTTPException(400, { message: "Игрок не участвовал в матче" });
      const existing = await db.query.mvpVotes.findFirst({
        where: and(eq(mvpVotes.gameId, game.id), eq(mvpVotes.voterId, me.id)),
      });
      if (existing) await db.update(mvpVotes).set({ voteeId }).where(eq(mvpVotes.id, existing.id));
      else await db.insert(mvpVotes).values({ gameId: game.id, voterId: me.id, voteeId });
      return c.json({ ok: true });
    },
  );
