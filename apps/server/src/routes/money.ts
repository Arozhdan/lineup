import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { payStatusSchema } from "@lineup/shared";
import { authRequired, roleRequired, type AuthEnv } from "../auth.js";
import { notifyUsers } from "../bot.js";
import QRCode from "qrcode";
import { db } from "../db/client.js";
import { games, refunds, settings, signups, users, venues, type Signup } from "../db/schema.js";
import { audit } from "../lib/audit.js";
import { buildSpd, looksLikeIban } from "../lib/spd.js";
import { signQr } from "./payqr.js";
import { nowSec, publicUser } from "../lib/serialize.js";
import { loadGame } from "./games.js";

const idParam = zValidator("param", z.object({ id: z.coerce.number().int().positive() }));

const feeOf = (price: number, s: Signup): number => price * (1 + s.guests);

/** What a signup still owes given its pay status. */
const debtOf = (price: number, s: Signup): number => {
  const fee = feeOf(price, s);
  if (s.payStatus === "unpaid" || s.payStatus === "marked") return fee;
  if (s.payStatus === "partial") return Math.round(fee / 2);
  return 0;
};

export const moneyRoutes = new Hono<AuthEnv>()
  .use(authRequired)

  /** Per-game payment reconciliation (organizer). */
  .get("/games/:id/reconcile", roleRequired("organizer"), idParam, async (c) => {
    const game = await loadGame(c.req.valid("param").id);
    const venue = await db.query.venues.findFirst({ where: eq(venues.id, game.venueId) });
    const roster = (await db.query.signups.findMany({ where: eq(signups.gameId, game.id) })).filter(
      (s) => s.status === "confirmed",
    );
    const players = roster.length
      ? await db.query.users.findMany({ where: inArray(users.id, roster.map((s) => s.userId)) })
      : [];
    const byId = new Map(players.map((u) => [u.id, u]));

    let collected = 0;
    let expected = 0;
    let debt = 0;
    const rows = roster.map((s) => {
      const fee = feeOf(game.price, s);
      const owed = debtOf(game.price, s);
      if (s.payStatus !== "waived") expected += fee;
      if (s.payStatus === "paid") collected += fee;
      if (s.payStatus === "partial") collected += fee - owed;
      debt += owed;
      return {
        ...publicUser(byId.get(s.userId)!),
        position: s.position,
        guests: s.guests,
        payStatus: s.payStatus,
        payMethod: s.payMethod,
        fee,
        owed,
      };
    });
    return c.json({
      gameId: game.id,
      title: game.title,
      startsAt: game.startsAt,
      price: game.price,
      rent: venue?.rent ?? 0,
      collected,
      expected,
      debt,
      rows,
    });
  })

  /** Organizer marks how a player settled up. */
  .post("/games/:id/pay-status", roleRequired("organizer"), idParam, zValidator("json", payStatusSchema), async (c) => {
    const game = await loadGame(c.req.valid("param").id);
    const { userId, payStatus, payMethod } = c.req.valid("json");
    const target = await db.query.signups.findFirst({
      where: and(eq(signups.gameId, game.id), eq(signups.userId, userId)),
    });
    if (!target || target.status !== "confirmed") throw new HTTPException(404, { message: "Игрок не в составе" });
    await db.update(signups).set({ payStatus, payMethod }).where(eq(signups.id, target.id));
    return c.json({ ok: true });
  })

  /** Ping a single debtor via the bot. */
  .post(
    "/games/:id/remind",
    roleRequired("organizer"),
    idParam,
    zValidator("json", z.object({ userId: z.number().int().positive() })),
    async (c) => {
      const game = await loadGame(c.req.valid("param").id);
      const { userId } = c.req.valid("json");
      const target = await db.query.signups.findFirst({
        where: and(eq(signups.gameId, game.id), eq(signups.userId, userId)),
      });
      if (!target || target.status !== "confirmed" || debtOf(game.price, target) === 0) {
        throw new HTTPException(404, { message: "Долга по этой игре нет" });
      }
      const sent = await notifyUsers(
        [userId],
        `💰 Напоминание об оплате: <b>${game.title}</b> — ${debtOf(game.price, target)}.\nПереведи по QR или рассчитайся наличными на игре.`,
        `/#/game/${game.id}/pay`,
      );
      return c.json({ sent });
    },
  )

  /** Ping every debtor of a game via the bot. */
  .post("/games/:id/remind-debtors", roleRequired("organizer"), idParam, async (c) => {
    const game = await loadGame(c.req.valid("param").id);
    const roster = (await db.query.signups.findMany({ where: eq(signups.gameId, game.id) })).filter(
      (s) => s.status === "confirmed" && debtOf(game.price, s) > 0,
    );
    const sent = await notifyUsers(
      roster.map((s) => s.userId),
      `💰 Напоминание об оплате: <b>${game.title}</b>.\nПереведи взнос по QR или рассчитайся наличными на игре.`,
      `/#/payments`,
    );
    return c.json({ sent });
  })

  /** Refund queue + history. */
  .get("/refunds", roleRequired("organizer"), async (c) => {
    const list = await db.query.refunds.findMany({ orderBy: [desc(refunds.createdAt)] });
    const userIds = [...new Set(list.map((r) => r.userId))];
    const gameIds = [...new Set(list.map((r) => r.gameId))];
    const players = userIds.length ? await db.query.users.findMany({ where: inArray(users.id, userIds) }) : [];
    const gameRows = gameIds.length ? await db.query.games.findMany({ where: inArray(games.id, gameIds) }) : [];
    const userById = new Map(players.map((u) => [u.id, u]));
    const gameById = new Map(gameRows.map((g) => [g.id, g]));
    return c.json(
      list.map((r) => ({
        id: r.id,
        amount: r.amount,
        reason: r.reason,
        auto: r.auto,
        status: r.status,
        createdAt: r.createdAt,
        user: userById.has(r.userId) ? publicUser(userById.get(r.userId)!) : null,
        gameTitle: gameById.get(r.gameId)?.title ?? "",
      })),
    );
  })

  /** Approve or reject a pending refund. */
  .post(
    "/refunds/:id/decide",
    roleRequired("organizer"),
    idParam,
    zValidator("json", z.object({ approve: z.boolean() })),
    async (c) => {
      const me = c.get("user");
      const { approve } = c.req.valid("json");
      const refund = await db.query.refunds.findFirst({ where: eq(refunds.id, c.req.valid("param").id) });
      if (!refund) throw new HTTPException(404, { message: "Возврат не найден" });
      if (refund.status !== "pending") throw new HTTPException(409, { message: "Уже решено" });
      await db
        .update(refunds)
        .set({ status: approve ? "done" : "rejected", decidedAt: nowSec() })
        .where(eq(refunds.id, refund.id));
      if (approve) {
        const game = await db.query.games.findFirst({ where: eq(games.id, refund.gameId) });
        await audit(me.id, "refund", `${refund.amount}`, game?.title ?? "");
        await notifyUsers([refund.userId], `↩️ Возврат ${refund.amount} за <b>${game?.title ?? "игру"}</b> оформлен.`);
      }
      return c.json({ ok: true });
    },
  )

  /** Player requests a manual refund. */
  .post(
    "/games/:id/request-refund",
    idParam,
    zValidator("json", z.object({ reason: z.string().trim().min(1).max(300) })),
    async (c) => {
      const me = c.get("user");
      const game = await loadGame(c.req.valid("param").id);
      const mine = await db.query.signups.findFirst({
        where: and(eq(signups.gameId, game.id), eq(signups.userId, me.id)),
      });
      if (!mine || (mine.payStatus !== "paid" && mine.payStatus !== "partial")) {
        throw new HTTPException(409, { message: "Нет оплаченного взноса за эту игру" });
      }
      const amount = mine.payStatus === "paid" ? feeOf(game.price, mine) : Math.round(game.price / 2);
      await db.insert(refunds).values({ gameId: game.id, userId: me.id, amount, reason: c.req.valid("json").reason });
      await notifyUsers([game.createdBy], `↩️ Запрос возврата от ${me.first}: <b>${game.title}</b>, ${amount}.`);
      return c.json({ ok: true });
    },
  )

  /** My payments & debts (player profile). */
  .get("/payments", async (c) => {
    const me = c.get("user");
    const mine = await db.query.signups.findMany({
      where: eq(signups.userId, me.id),
      orderBy: [desc(signups.createdAt)],
    });
    const relevant = mine.filter((s) => s.status === "confirmed");
    const gameIds = [...new Set(relevant.map((s) => s.gameId))];
    const gameRows = gameIds.length ? await db.query.games.findMany({ where: inArray(games.id, gameIds) }) : [];
    const gameById = new Map(gameRows.map((g) => [g.id, g]));
    const items = relevant
      .map((s) => {
        const g = gameById.get(s.gameId);
        if (!g || g.price === 0 || g.cancelledAt) return null;
        return {
          gameId: g.id,
          title: g.title,
          startsAt: g.startsAt,
          fee: feeOf(g.price, s),
          owed: debtOf(g.price, s),
          payStatus: s.payStatus,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    const debt = items.reduce((sum, x) => sum + (x.payStatus === "marked" ? 0 : x.owed), 0);

    // Personal QR Platba for the total debt — shown and downloadable in the sheet.
    const cfg = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
    let debtQr: { dataUrl: string; downloadUrl: string } | null = null;
    if (debt > 0 && cfg && looksLikeIban(cfg.qrAccount)) {
      const payload = buildSpd({
        iban: cfg.qrAccount,
        recipient: cfg.qrRecipient || cfg.name,
        amount: debt,
        currency: cfg.currency,
        message: `Взносы · ${cfg.name}`,
      });
      debtQr = {
        dataUrl: await QRCode.toDataURL(payload, { width: 512, margin: 2 }),
        downloadUrl: `/api/money/debtqr.png?u=${me.id}&sig=${signQr(`debt:${me.id}`)}`,
      };
    }
    return c.json({ debt, items, debtQr });
  });
