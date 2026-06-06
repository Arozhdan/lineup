import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { draftConfigSchema } from "@lineup/shared";
import { authRequired, roleRequired, type AuthEnv } from "../auth.js";
import { notifyUsers, rosterUserIds } from "../bot.js";
import { db } from "../db/client.js";
import { games, signups, users, type DraftState } from "../db/schema.js";
import { autoBalance } from "../lib/balance.js";
import { nowSec } from "../lib/serialize.js";
import { loadGame } from "./games.js";

const idParam = zValidator("param", z.object({ id: z.coerce.number().int().positive() }));

const confirmedRoster = async (gameId: number) => {
  const all = await db.query.signups.findMany({ where: eq(signups.gameId, gameId) });
  return all.filter((s) => s.status === "confirmed");
};

// roleRequired is applied per-route (not via .use) so the guard doesn't leak
// onto sibling routers mounted under the same /games prefix.
const organizer = roleRequired("organizer");

export const teamRoutes = new Hono<AuthEnv>()
  .use(authRequired)

  /** Auto-balance the confirmed roster into two teams. */
  .post("/:id/teams/auto", organizer, idParam, async (c) => {
    const game = await loadGame(c.req.valid("param").id);
    const roster = await confirmedRoster(game.id);
    if (roster.length < 2) throw new HTTPException(400, { message: "Мало игроков для деления" });
    const players = await db.query.users.findMany({ where: inArray(users.id, roster.map((s) => s.userId)) });
    const levelOf = new Map(players.map((u) => [u.id, u.level]));
    const split = autoBalance(
      roster.map((s) => ({ userId: s.userId, level: levelOf.get(s.userId) ?? 3, position: s.position })),
    );
    for (const [userId, team] of split) {
      await db.update(signups).set({ team }).where(and(eq(signups.gameId, game.id), eq(signups.userId, userId)));
    }
    await db.update(games).set({ draft: null }).where(eq(games.id, game.id));
    return c.json({ ok: true });
  })

  /** Manually move a player to team a / b / pool (null). */
  .post(
    "/:id/teams/assign",
    organizer,
    idParam,
    zValidator("json", z.object({ userId: z.number().int().positive(), team: z.enum(["a", "b"]).nullable() })),
    async (c) => {
      const game = await loadGame(c.req.valid("param").id);
      const { userId, team } = c.req.valid("json");
      const target = await db.query.signups.findFirst({
        where: and(eq(signups.gameId, game.id), eq(signups.userId, userId)),
      });
      if (!target || target.status !== "confirmed") throw new HTTPException(404, { message: "Игрок не в составе" });
      await db.update(signups).set({ team }).where(eq(signups.id, target.id));
      return c.json({ ok: true });
    },
  )

  /** Start a captains' draft: captains take their teams, everyone else resets to the pool. */
  .post("/:id/draft/start", organizer, idParam, zValidator("json", draftConfigSchema), async (c) => {
    const game = await loadGame(c.req.valid("param").id);
    const cfg = c.req.valid("json");
    const roster = await confirmedRoster(game.id);
    const ids = new Set(roster.map((s) => s.userId));
    if (!ids.has(cfg.captainA) || !ids.has(cfg.captainB) || cfg.captainA === cfg.captainB) {
      throw new HTTPException(400, { message: "Капитаны должны быть разными игроками из состава" });
    }
    await db.update(signups).set({ team: null }).where(eq(signups.gameId, game.id));
    await db
      .update(signups)
      .set({ team: "a" })
      .where(and(eq(signups.gameId, game.id), eq(signups.userId, cfg.captainA)));
    await db
      .update(signups)
      .set({ team: "b" })
      .where(and(eq(signups.gameId, game.id), eq(signups.userId, cfg.captainB)));
    const draft: DraftState = {
      captainA: cfg.captainA,
      captainB: cfg.captainB,
      pickSeconds: cfg.pickSeconds,
      turn: "a",
      turnEndsAt: cfg.pickSeconds ? nowSec() + cfg.pickSeconds : null,
      startedAt: nowSec(),
    };
    await db.update(games).set({ draft, splitMode: "draft" }).where(eq(games.id, game.id));
    return c.json({ draft });
  })

  /** Current captain picks a player (or pass userId=0 to auto-pick best available). */
  .post(
    "/:id/draft/pick",
    organizer,
    idParam,
    zValidator("json", z.object({ userId: z.number().int().min(0) })),
    async (c) => {
      const game = await loadGame(c.req.valid("param").id);
      const draft = game.draft;
      if (!draft) throw new HTTPException(409, { message: "Драфт не запущен" });
      const roster = await confirmedRoster(game.id);
      const pool = roster.filter((s) => !s.team);
      if (!pool.length) throw new HTTPException(409, { message: "Все игроки распределены" });

      let { userId } = c.req.valid("json");
      if (!userId) {
        // Auto-pick: strongest available player.
        const players = await db.query.users.findMany({ where: inArray(users.id, pool.map((s) => s.userId)) });
        const levelOf = new Map(players.map((u) => [u.id, u.level]));
        userId = [...pool].sort((a, b) => (levelOf.get(b.userId) ?? 3) - (levelOf.get(a.userId) ?? 3))[0]!.userId;
      }
      const target = pool.find((s) => s.userId === userId);
      if (!target) throw new HTTPException(404, { message: "Игрок уже выбран или не в составе" });

      await db.update(signups).set({ team: draft.turn }).where(eq(signups.id, target.id));
      const remaining = pool.length - 1;
      const next: DraftState = remaining
        ? {
            ...draft,
            turn: draft.turn === "a" ? "b" : "a",
            turnEndsAt: draft.pickSeconds ? nowSec() + draft.pickSeconds : null,
          }
        : null;
      await db.update(games).set({ draft: next }).where(eq(games.id, game.id));
      return c.json({ draft: next, done: !remaining });
    },
  )

  /** Publish teams: lock them in and notify the roster. */
  .post("/:id/teams/publish", organizer, idParam, async (c) => {
    const game = await loadGame(c.req.valid("param").id);
    const roster = await confirmedRoster(game.id);
    const a = roster.filter((s) => s.team === "a").length;
    const b = roster.filter((s) => s.team === "b").length;
    if (!a || !b) throw new HTTPException(400, { message: "Обе команды должны быть непустыми" });
    await db.update(games).set({ teamsPublishedAt: nowSec(), draft: null }).where(eq(games.id, game.id));
    const ids = await rosterUserIds(game.id);
    await notifyUsers(
      ids,
      `📣 Составы на <b>${game.title}</b> опубликованы!\nКоманда А (светлые): ${a} · Команда Б (тёмные): ${b}.\nСвой цвет смотри в приложении.`,
      `/#/game/${game.id}`,
    );
    return c.json({ ok: true, sent: ids.length });
  });
