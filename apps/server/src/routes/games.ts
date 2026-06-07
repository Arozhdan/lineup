import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { createGameSchema, editGameSchema } from "@lineup/shared";
import { authRequired, roleRequired, type AuthEnv } from "../auth.js";
import { notifyUsers, rosterUserIds } from "../bot.js";
import { db } from "../db/client.js";
import { games, gameStats, groups, mvpVotes, refunds, seasons, settings, signups, users, venues } from "../db/schema.js";
import { audit } from "../lib/audit.js";
import { fmtDateTime } from "../lib/dates.js";
import { gameCard, nowSec, publicUser } from "../lib/serialize.js";
import { canSeeGame, myGroupIds } from "../lib/visibility.js";
import { activeSeasonData } from "../lib/season.js";
import { mvpWinners } from "../lib/stats.js";

const idParam = zValidator("param", z.object({ id: z.coerce.number().int().positive() }));

export async function loadGame(id: number) {
  const game = await db.query.games.findFirst({ where: eq(games.id, id) });
  if (!game) throw new HTTPException(404, { message: "Игра не найдена" });
  return game;
}

export const gamesRoutes = new Hono<AuthEnv>()
  .use(authRequired)

  /** Upcoming feed (includes live games). */
  .get("/", async (c) => {
    const me = c.get("user");
    const cutoff = nowSec() - 6 * 3600;
    const list = await db.query.games.findMany({
      where: and(isNull(games.finishedAt), isNull(games.cancelledAt), gt(games.startsAt, cutoff)),
      orderBy: [games.startsAt],
    });
    const ids = list.map((g) => g.id);
    const allSignups = ids.length ? await db.query.signups.findMany({ where: inArray(signups.gameId, ids) }) : [];
    const allVenues = await db.query.venues.findMany();
    const venueById = new Map(allVenues.map((v) => [v.id, v]));
    const groupIds = me.role === "player" ? await myGroupIds(me.id) : new Set<number>();
    const visible = list.filter((g) =>
      canSeeGame(
        g,
        me,
        groupIds,
        allSignups.find((s) => s.gameId === g.id && s.userId === me.id) ?? null,
      ),
    );
    return c.json(
      visible.map((g) => ({
        ...gameCard(
          g,
          allSignups.filter((s) => s.gameId === g.id),
          venueById.get(g.venueId),
          me.id,
        ),
        restricted: me.role !== "player" && !!g.visibleTo?.length,
      })),
    );
  })

  /** Finished games I took part in (my games → past). */
  .get("/past", async (c) => {
    const me = c.get("user");
    const mySignups = await db.query.signups.findMany({
      where: and(eq(signups.userId, me.id), eq(signups.status, "confirmed")),
    });
    const ids = mySignups.map((s) => s.gameId);
    if (!ids.length) return c.json([]);
    const list = await db.query.games.findMany({
      where: inArray(games.id, ids),
      orderBy: [desc(games.startsAt)],
    });
    const finished = list.filter((g) => g.finishedAt);
    const finishedIds = finished.map((g) => g.id);
    // Only organizer-confirmed stats count anywhere outside the entry screen.
    const stats = finishedIds.length
      ? await db.query.gameStats.findMany({
          where: and(inArray(gameStats.gameId, finishedIds), eq(gameStats.userId, me.id), eq(gameStats.confirmed, true)),
        })
      : [];
    const votes = finishedIds.length
      ? await db.query.mvpVotes.findMany({ where: inArray(mvpVotes.gameId, finishedIds) })
      : [];
    const winners = mvpWinners(votes);
    const allVenues = await db.query.venues.findMany();
    const venueById = new Map(allVenues.map((v) => [v.id, v]));
    return c.json(
      finished.map((g) => {
        const mine = mySignups.find((s) => s.gameId === g.id)!;
        const st = stats.find((s) => s.gameId === g.id);
        const myTeam = mine.team;
        const result =
          g.scoreA === g.scoreB ? "D" : (g.scoreA > g.scoreB ? "a" : "b") === myTeam ? "W" : myTeam ? "L" : "D";
        return {
          id: g.id,
          title: g.title,
          startsAt: g.startsAt,
          venue: venueById.get(g.venueId)?.name ?? "",
          score: `${g.scoreA} – ${g.scoreB}`,
          result,
          myGoals: st?.goals ?? 0,
          myAssists: st?.assists ?? 0,
          mvp: winners.get(g.id) === me.id,
        };
      }),
    );
  })

  /** Full game detail: meta, roster, waitlist, pending, my signup. */
  .get("/:id", idParam, async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    const venue = await db.query.venues.findFirst({ where: eq(venues.id, game.venueId) });
    const all = await db.query.signups.findMany({ where: eq(signups.gameId, game.id), orderBy: [signups.createdAt] });
    const userIds = [...new Set(all.map((s) => s.userId))];
    const players = userIds.length ? await db.query.users.findMany({ where: inArray(users.id, userIds) }) : [];
    const byId = new Map(players.map((u) => [u.id, u]));
    const cfg = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
    // Season rating (points) + attendance reliability for roster/approval rows.
    const { aggregates, reliability } = await activeSeasonData();

    const row = (s: (typeof all)[number]) => ({
      ...publicUser(byId.get(s.userId)!),
      position: s.position,
      guests: s.guests,
      payStatus: s.payStatus,
      payMethod: s.payMethod,
      checkedIn: s.checkedIn,
      team: s.team,
      signupId: s.id,
      points: aggregates.get(s.userId)?.points ?? 0,
      reliability: reliability.get(s.userId)?.reliability ?? 100,
    });

    const active = all.filter((s) => s.status !== "cancelled");
    const mine = active.find((s) => s.userId === me.id) ?? null;

    // Private events: pretend the game doesn't exist for non-members.
    const groupIds = me.role === "player" ? await myGroupIds(me.id) : new Set<number>();
    if (!canSeeGame(game, me, groupIds, mine)) throw new HTTPException(404, { message: "Игра не найдена" });

    // Group names are organizer-only — players never learn about audiences.
    const isAdmin = me.role !== "player";
    const audienceGroups =
      isAdmin && game.visibleTo?.length
        ? (await db.query.groups.findMany({ where: inArray(groups.id, game.visibleTo) })).map((x) => ({ id: x.id, name: x.name }))
        : [];

    return c.json({
      ...gameCard(game, all, venue, me.id),
      restricted: isAdmin && !!game.visibleTo?.length,
      visibleTo: isAdmin ? (game.visibleTo ?? null) : null,
      audienceGroups,
      venueInfo: venue
        ? { id: venue.id, name: venue.name, addr: venue.addr, rent: venue.rent, mapsUrl: venue.mapsUrl, lat: venue.lat, lng: venue.lng }
        : null,
      startedAt: game.startedAt,
      finishedAt: game.finishedAt,
      cancelDeadlineHours: cfg?.cancelDeadlineHours ?? 2,
      roster: active.filter((s) => s.status === "confirmed").map(row),
      waitlist: active.filter((s) => s.status === "waitlist").map(row),
      pending: active.filter((s) => s.status === "pending").map(row),
      draft: game.draft,
      my: mine
        ? { status: mine.status, position: mine.position, guests: mine.guests, payStatus: mine.payStatus, team: mine.team }
        : null,
      createdBy: game.createdBy,
    });
  })

  .post("/", roleRequired("organizer"), zValidator("json", createGameSchema), async (c) => {
    const me = c.get("user");
    const input = c.req.valid("json");
    const venue = await db.query.venues.findFirst({ where: eq(venues.id, input.venueId) });
    if (!venue) throw new HTTPException(400, { message: "Площадка не найдена" });
    const season = await db.query.seasons.findFirst({ where: eq(seasons.active, true) });
    const base = {
      title: input.title,
      startsAt: input.startsAt,
      deadlineAt: input.deadlineAt ?? null,
      venueId: input.venueId,
      notes: input.notes,
      visibleTo: input.visibleTo?.length ? input.visibleTo : null,
      seasonId: season?.id ?? null,
      createdBy: me.id,
    };
    const [created] = await db
      .insert(games)
      .values(
        input.kind === "game"
          ? {
              ...base,
              kind: "game",
              aside: input.aside,
              mainSlots: input.aside * 2,
              subSlots: input.subSlots,
              price: input.price,
              payWhen: input.payWhen,
              splitMode: input.splitMode,
              approval: input.approval,
            }
          : { ...base, kind: "meetup", capacity: input.capacity, price: input.price, payWhen: "after" },
      )
      .returning();
    return c.json({ id: created!.id }, 201);
  })

  .patch("/:id", roleRequired("organizer"), idParam, zValidator("json", editGameSchema), async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    const patch = c.req.valid("json");
    if (patch.venueId) {
      const venue = await db.query.venues.findFirst({ where: eq(venues.id, patch.venueId) });
      if (!venue) throw new HTTPException(400, { message: "Площадка не найдена" });
    }
    await db.update(games).set(patch).where(eq(games.id, game.id));
    if (patch.startsAt && patch.startsAt !== game.startsAt) {
      await audit(me.id, "edit", game.title, `перенос на ${fmtDateTime(patch.startsAt)}`);
      const ids = await rosterUserIds(game.id);
      await notifyUsers(ids, `📅 <b>${game.title}</b> перенесена на ${fmtDateTime(patch.startsAt)}.`, `/#/game/${game.id}`);
    }
    return c.json({ ok: true });
  })

  .post("/:id/cancel", roleRequired("organizer"), idParam, zValidator("json", z.object({ reason: z.string().max(300).default("") })), async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    if (game.cancelledAt) throw new HTTPException(409, { message: "Игра уже отменена" });
    await db.update(games).set({ cancelledAt: nowSec() }).where(eq(games.id, game.id));

    // Queue refunds for everyone who already paid; the organizer closes
    // them in «Возвраты» once the money is actually returned.
    const all = await db.query.signups.findMany({ where: eq(signups.gameId, game.id) });
    for (const s of all) {
      if (s.status === "confirmed" && (s.payStatus === "paid" || s.payStatus === "partial") && game.price > 0) {
        const amount = s.payStatus === "paid" ? game.price * (1 + s.guests) : Math.round(game.price / 2);
        await db.insert(refunds).values({ gameId: game.id, userId: s.userId, amount, reason: "игра отменена", auto: true });
      }
    }
    const { reason } = c.req.valid("json");
    await audit(me.id, "cancel", game.title, reason);
    const ids = await rosterUserIds(game.id);
    await notifyUsers(ids, `❌ <b>${game.title}</b> отменена.${reason ? `\nПричина: ${reason}` : ""}\nОрганизатор вернёт взносы.`);
    return c.json({ ok: true });
  });
