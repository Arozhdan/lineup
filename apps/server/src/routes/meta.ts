import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { assignRoleSchema, broadcastSchema, complaintSchema, moderationSchema, seasonSchema, seriesSchema, venueSchema } from "@lineup/shared";
import { authRequired, roleRequired, type AuthEnv } from "../auth.js";
import { notifyUsers, rosterUserIds } from "../bot.js";
import { db } from "../db/client.js";
import { auditLog, broadcasts, complaints, games, moderation, seasons, series, signups, users, venues } from "../db/schema.js";
import { audit } from "../lib/audit.js";
import { nowSec, publicUser } from "../lib/serialize.js";
import { activeSeasonData } from "../lib/season.js";

const idParam = zValidator("param", z.object({ id: z.coerce.number().int().positive() }));

export const metaRoutes = new Hono<AuthEnv>()
  .use(authRequired)

  /* ------------------------------------------------------------- venues */
  .get("/venues", async (c) => {
    const list = await db.query.venues.findMany({ where: eq(venues.archived, false) });
    return c.json(list);
  })
  .post("/venues", roleRequired("organizer"), zValidator("json", venueSchema), async (c) => {
    const me = c.get("user");
    const [created] = await db.insert(venues).values(c.req.valid("json")).returning();
    await audit(me.id, "venue", created!.name, "добавлена площадка");
    return c.json(created!, 201);
  })
  .patch("/venues/:id", roleRequired("organizer"), idParam, zValidator("json", venueSchema.partial()), async (c) => {
    const venue = await db.query.venues.findFirst({ where: eq(venues.id, c.req.valid("param").id) });
    if (!venue) throw new HTTPException(404, { message: "Площадка не найдена" });
    await db.update(venues).set(c.req.valid("json")).where(eq(venues.id, venue.id));
    return c.json({ ok: true });
  })
  .delete("/venues/:id", roleRequired("organizer"), idParam, async (c) => {
    await db.update(venues).set({ archived: true }).where(eq(venues.id, c.req.valid("param").id));
    return c.json({ ok: true });
  })

  /* ------------------------------------------------------------ seasons */
  .get("/seasons", async (c) => {
    const list = await db.query.seasons.findMany({ orderBy: [desc(seasons.startsAt)] });
    const allGames = await db.query.games.findMany();
    const allSignups = await db.query.signups.findMany();
    return c.json(
      list.map((s) => {
        const ids = new Set(allGames.filter((g) => g.seasonId === s.id && !g.cancelledAt).map((g) => g.id));
        const players = new Set(allSignups.filter((x) => ids.has(x.gameId) && x.status === "confirmed").map((x) => x.userId));
        return { ...s, games: ids.size, players: players.size };
      }),
    );
  })
  .post("/seasons", roleRequired("organizer"), zValidator("json", seasonSchema), async (c) => {
    const me = c.get("user");
    const input = c.req.valid("json");
    if (input.endsAt <= input.startsAt) throw new HTTPException(400, { message: "Конец сезона раньше начала" });
    await db.update(seasons).set({ active: false, archived: input.archivePrevious }).where(eq(seasons.active, true));
    const [created] = await db
      .insert(seasons)
      .values({ name: input.name, startsAt: input.startsAt, endsAt: input.endsAt, active: true })
      .returning();
    await audit(me.id, "season", input.name, "открыт новый сезон");
    return c.json(created!, 201);
  })

  /* ------------------------------------------------------------- series */
  .get("/series", roleRequired("organizer"), async (c) => c.json(await db.query.series.findMany()))
  .post("/series", roleRequired("organizer"), zValidator("json", seriesSchema), async (c) => {
    const [created] = await db.insert(series).values(c.req.valid("json")).returning();
    return c.json(created!, 201);
  })
  .patch("/series/:id", roleRequired("organizer"), idParam, zValidator("json", seriesSchema.partial()), async (c) => {
    const row = await db.query.series.findFirst({ where: eq(series.id, c.req.valid("param").id) });
    if (!row) throw new HTTPException(404, { message: "Серия не найдена" });
    await db.update(series).set(c.req.valid("json")).where(eq(series.id, row.id));
    return c.json({ ok: true });
  })

  /* ------------------------------------------------------------ reports */
  .get(
    "/reports",
    roleRequired("organizer"),
    zValidator("query", z.object({ range: z.enum(["week", "month", "season"]).default("month") })),
    async (c) => {
      const { range } = c.req.valid("query");
      const { season } = await activeSeasonData();
      const since = range === "week" ? nowSec() - 7 * 86400 : nowSec() - 30 * 86400;

      // "Сезон" means membership in the active season, not a date window —
      // games of an archived season may have been played inside the new
      // season's dates and must not leak in.
      const allGames = (await db.query.games.findMany()).filter(
        (g) =>
          g.finishedAt &&
          !g.cancelledAt &&
          (range === "season" ? (season ? g.seasonId === season.id : true) : g.startsAt >= since),
      );
      const ids = allGames.map((g) => g.id);
      const allSignups = ids.length ? await db.query.signups.findMany({ where: inArray(signups.gameId, ids) }) : [];
      const confirmed = allSignups.filter((s) => s.status === "confirmed");
      const gameById = new Map(allGames.map((g) => [g.id, g]));

      let turnover = 0;
      for (const s of confirmed) {
        const g = gameById.get(s.gameId)!;
        if (s.payStatus === "paid") turnover += g.price * (1 + s.guests);
        if (s.payStatus === "partial") turnover += Math.round(g.price / 2);
      }
      const attended = confirmed.filter((s) => !s.noShow).length;

      // Participations per ISO week for the bar chart (last 6 buckets).
      const weeks: { label: string; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const from = nowSec() - (i + 1) * 7 * 86400;
        const to = nowSec() - i * 7 * 86400;
        const count = confirmed.filter((s) => {
          const g = gameById.get(s.gameId)!;
          return g.startsAt >= from && g.startsAt < to;
        }).length;
        weeks.push({ label: `н${6 - i}`, count });
      }

      const allVenues = await db.query.venues.findMany();
      const venueCount = allVenues
        .map((v) => ({ name: v.name, games: allGames.filter((g) => g.venueId === v.id).length }))
        .filter((v) => v.games > 0)
        .sort((a, b) => b.games - a.games);

      return c.json({
        games: allGames.length,
        participations: confirmed.length,
        turnover,
        attendance: confirmed.length ? Math.round((100 * attended) / confirmed.length) : 100,
        weeks,
        venues: venueCount,
      });
    },
  )

  /* --------------------------------------------------------------- audit */
  .get("/audit", roleRequired("organizer"), async (c) => {
    const list = await db.query.auditLog.findMany({ orderBy: [desc(auditLog.createdAt)], limit: 100 });
    const actorIds = [...new Set(list.map((a) => a.actorId))];
    const actors = actorIds.length ? await db.query.users.findMany({ where: inArray(users.id, actorIds) }) : [];
    const byId = new Map(actors.map((u) => [u.id, u]));
    return c.json(
      list.map((a) => ({
        id: a.id,
        action: a.action,
        target: a.target,
        reason: a.reason,
        createdAt: a.createdAt,
        who: byId.has(a.actorId) ? `${byId.get(a.actorId)!.first} ${byId.get(a.actorId)!.last.charAt(0)}.`.trim() : "?",
      })),
    );
  })

  /* ---------------------------------------------------------- moderation */
  .get("/moderation", roleRequired("organizer"), async (c) => {
    const { reliability } = await activeSeasonData();
    const actions = await db.query.moderation.findMany({ orderBy: [desc(moderation.createdAt)] });
    const allComplaints = await db.query.complaints.findMany({ orderBy: [desc(complaints.createdAt)] });
    const openComplaints = allComplaints.filter((x) => x.status === "open");
    const flaggedIds = [...reliability.values()]
      .filter((r) => r.signups >= 2 && (r.reliability < 80 || r.noShows > 0 || r.lateCancels > 0))
      .map((r) => r.userId);
    const userIds = [
      ...new Set([
        ...flaggedIds,
        ...actions.map((a) => a.userId),
        ...openComplaints.flatMap((x) => [x.aboutId, x.byId]),
      ]),
    ];
    const players = userIds.length ? await db.query.users.findMany({ where: inArray(users.id, userIds) }) : [];
    const byId = new Map(players.map((u) => [u.id, u]));
    const activeBans = new Set(actions.filter((a) => a.kind === "ban" && !a.liftedAt).map((a) => a.userId));
    const gameIds = [...new Set(openComplaints.map((x) => x.gameId).filter((x): x is number => !!x))];
    const gameRows = gameIds.length ? await db.query.games.findMany({ where: inArray(games.id, gameIds) }) : [];
    const gameById = new Map(gameRows.map((g) => [g.id, g]));
    return c.json({
      complaints: openComplaints
        .filter((x) => byId.has(x.aboutId))
        .map((x) => ({
          id: x.id,
          about: publicUser(byId.get(x.aboutId)!),
          by: byId.has(x.byId) ? `${byId.get(x.byId)!.first} ${byId.get(x.byId)!.last}`.trim() : "?",
          reason: x.reason,
          gameTitle: x.gameId ? (gameById.get(x.gameId)?.title ?? "") : "",
          createdAt: x.createdAt,
          banned: activeBans.has(x.aboutId),
          reliability: reliability.get(x.aboutId)?.reliability ?? 100,
        })),
      flagged: flaggedIds
        .filter((id) => byId.has(id))
        .map((id) => {
          const r = reliability.get(id)!;
          const issue =
            r.noShows > 0
              ? `${r.noShows} неявк${r.noShows === 1 ? "а" : "и"}`
              : r.lateCancels > 0
                ? `${r.lateCancels} поздн. отмен${r.lateCancels === 1 ? "а" : "ы"}`
                : `надёжность ${r.reliability}%`;
          return {
            ...publicUser(byId.get(id)!),
            reliability: r.reliability,
            issue,
            sev: r.reliability < 70 ? "high" : r.reliability < 85 ? "mid" : "low",
            banned: activeBans.has(id),
          };
        }),
      actions: actions.map((a) => ({
        id: a.id,
        kind: a.kind,
        reason: a.reason,
        liftedAt: a.liftedAt,
        createdAt: a.createdAt,
        user: byId.has(a.userId) ? publicUser(byId.get(a.userId)!) : null,
      })),
    });
  })
  .post("/moderation", roleRequired("organizer"), zValidator("json", moderationSchema), async (c) => {
    const me = c.get("user");
    const { userId, kind, reason } = c.req.valid("json");
    const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!target) throw new HTTPException(404, { message: "Игрок не найден" });
    await db.insert(moderation).values({ userId, kind, reason, byId: me.id });
    await db
      .update(complaints)
      .set({ status: "resolved", resolvedAt: nowSec() })
      .where(and(eq(complaints.aboutId, userId), eq(complaints.status, "open")));
    await audit(me.id, kind === "ban" ? "ban" : "warn", `${target.first} ${target.last}`.trim(), reason);
    await notifyUsers(
      [userId],
      kind === "ban"
        ? `🚫 Организатор закрыл тебе запись на игры.\nПричина: ${reason}`
        : `⚠️ Предупреждение от организатора: ${reason}`,
    );
    return c.json({ ok: true });
  })
  .post("/moderation/:id/lift", roleRequired("organizer"), idParam, async (c) => {
    const row = await db.query.moderation.findFirst({ where: eq(moderation.id, c.req.valid("param").id) });
    if (!row) throw new HTTPException(404, { message: "Запись не найдена" });
    await db.update(moderation).set({ liftedAt: nowSec() }).where(eq(moderation.id, row.id));
    if (row.kind === "ban") await notifyUsers([row.userId], "✅ Бан снят — запись на игры снова доступна.");
    return c.json({ ok: true });
  })

  /* ---------------------------------------------------------- complaints */
  /** Any player reports another player; moderators see it in Модерация. */
  .post("/complaints", zValidator("json", complaintSchema), async (c) => {
    const me = c.get("user");
    const { userId, gameId, reason } = c.req.valid("json");
    if (userId === me.id) throw new HTTPException(400, { message: "Нельзя пожаловаться на себя" });
    const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!target) throw new HTTPException(404, { message: "Игрок не найден" });
    const dupe = await db.query.complaints.findFirst({
      where: and(eq(complaints.aboutId, userId), eq(complaints.byId, me.id), eq(complaints.status, "open")),
    });
    if (dupe) throw new HTTPException(409, { message: "Твоя жалоба на этого игрока уже на рассмотрении" });
    await db.insert(complaints).values({ aboutId: userId, byId: me.id, gameId, reason });
    const mods = (await db.query.users.findMany()).filter((u) => u.role !== "player").map((u) => u.id);
    await notifyUsers(
      mods,
      `⚠️ Жалоба на <b>${target.first} ${target.last}</b>: ${reason}`.trim(),
      "/#/moderation",
    );
    return c.json({ ok: true }, 201);
  })

  /** Moderator dismisses a complaint without action. */
  .post("/complaints/:id/dismiss", roleRequired("organizer"), idParam, async (c) => {
    const complaint = await db.query.complaints.findFirst({ where: eq(complaints.id, c.req.valid("param").id) });
    if (!complaint) throw new HTTPException(404, { message: "Жалоба не найдена" });
    if (complaint.status !== "open") throw new HTTPException(409, { message: "Жалоба уже рассмотрена" });
    await db.update(complaints).set({ status: "dismissed", resolvedAt: nowSec() }).where(eq(complaints.id, complaint.id));
    return c.json({ ok: true });
  })

  /* -------------------------------------------------------------- roles */
  .get("/roles", roleRequired("owner"), async (c) => {
    const all = await db.query.users.findMany();
    return c.json(all.map((u) => ({ ...publicUser(u), tgId: u.tgId })));
  })
  .post("/roles", roleRequired("owner"), zValidator("json", assignRoleSchema), async (c) => {
    const me = c.get("user");
    const { userId, role } = c.req.valid("json");
    if (userId === me.id) throw new HTTPException(400, { message: "Свою роль менять нельзя" });
    const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!target) throw new HTTPException(404, { message: "Игрок не найден" });
    await db.update(users).set({ role }).where(eq(users.id, userId));
    await audit(me.id, "role", `${target.first} ${target.last}`.trim(), `роль: ${role}`);
    await notifyUsers([userId], role === "player" ? "Твоя роль изменена: игрок." : `Тебе выдана роль: <b>${role === "owner" ? "владелец" : "организатор"}</b>.`);
    return c.json({ ok: true });
  })

  /* ----------------------------------------------------------- broadcast */
  .post("/broadcast", roleRequired("organizer"), zValidator("json", broadcastSchema), async (c) => {
    const me = c.get("user");
    const { audience, gameId, text } = c.req.valid("json");
    let userIds: number[] = [];
    if (audience === "all") {
      userIds = (await db.query.users.findMany()).map((u) => u.id);
    } else {
      if (!gameId) throw new HTTPException(400, { message: "Для этой аудитории нужна игра" });
      if (audience === "roster") userIds = await rosterUserIds(gameId);
      else {
        const all = await db.query.signups.findMany({ where: eq(signups.gameId, gameId) });
        userIds = all.filter((s) => s.status === "waitlist").map((s) => s.userId);
      }
    }
    userIds = userIds.filter((id) => id !== me.id);
    const sent = await notifyUsers(userIds, `📣 ${text}`);
    await db.insert(broadcasts).values({ byId: me.id, audience, gameId, text, sentTo: sent });
    return c.json({ sent, total: userIds.length });
  })

  /** Whether I'm currently banned (player-facing). */
  .get("/me/ban", async (c) => {
    const me = c.get("user");
    const ban = await db.query.moderation.findFirst({
      where: and(eq(moderation.userId, me.id), eq(moderation.kind, "ban"), isNull(moderation.liftedAt)),
    });
    return c.json({ banned: !!ban, reason: ban?.reason ?? null });
  });
