import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { signupSchema } from "@lineup/shared";
import { authRequired, roleRequired, type AuthEnv } from "../auth.js";
import { notifyUsers } from "../bot.js";
import { db } from "../db/client.js";
import { moderation, refunds, settings, signups, users, type Game, type Signup } from "../db/schema.js";
import { filledCount, gameCapacity, nowSec } from "../lib/serialize.js";
import { canSeeGame, myGroupIds } from "../lib/visibility.js";
import { buildPayMsg, buildSpd, looksLikeIban } from "../lib/spd.js";
import { signQr } from "./payqr.js";
import QRCode from "qrcode";
import { loadGame } from "./games.js";

const idParam = zValidator("param", z.object({ id: z.coerce.number().int().positive() }));

const assertJoinable = (game: Game) => {
  if (game.cancelledAt) throw new HTTPException(409, { message: "Игра отменена" });
  if (game.finishedAt || game.startedAt) throw new HTTPException(409, { message: "Игра уже идёт или завершена" });
};

/** Move the first waitlisted player into the roster after a spot frees up. */
async function promoteFromWaitlist(game: Game): Promise<void> {
  const all = await db.query.signups.findMany({ where: eq(signups.gameId, game.id), orderBy: [signups.createdAt] });
  const active = all.filter((s) => s.status !== "cancelled");
  const cap = gameCapacity(game);
  if (cap > 0 && filledCount(active) >= cap) return;
  const next = active.find((s) => s.status === "waitlist");
  if (!next) return;
  await db
    .update(signups)
    .set({ status: "confirmed", payStatus: game.price > 0 ? "unpaid" : "none" })
    .where(eq(signups.id, next.id));
  await notifyUsers(
    [next.userId],
    `🎉 Место освободилось — ты в составе <b>${game.title}</b>!` +
      (game.price > 0 ? `\nВзнос ${game.price} — оплати по QR в приложении.` : ""),
    game.price > 0 ? `/#/game/${game.id}/pay` : `/#/game/${game.id}`,
  );
}

export const signupRoutes = new Hono<AuthEnv>()
  .use(authRequired)

  /** Sign up for a game (or send a request if approval is required). */
  .post("/:id/signup", idParam, zValidator("json", signupSchema), async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    assertJoinable(game);

    const ban = await db.query.moderation.findFirst({
      where: and(eq(moderation.userId, me.id), eq(moderation.kind, "ban"), isNull(moderation.liftedAt)),
    });
    if (ban) throw new HTTPException(403, { message: "Запись недоступна: бан организатора" });

    const { position, guests } = c.req.valid("json");
    const existing = await db.query.signups.findFirst({
      where: and(eq(signups.gameId, game.id), eq(signups.userId, me.id)),
    });
    if (existing && existing.status !== "cancelled") {
      throw new HTTPException(409, { message: "Ты уже записан на эту игру" });
    }
    if (!canSeeGame(game, me, me.role === "player" ? await myGroupIds(me.id) : new Set(), existing)) {
      throw new HTTPException(404, { message: "Игра не найдена" });
    }

    const all = await db.query.signups.findMany({ where: eq(signups.gameId, game.id) });
    const active = all.filter((s) => s.status !== "cancelled");
    const cap = gameCapacity(game);
    const isFull = cap > 0 && filledCount(active) + 1 + guests > cap;

    const status: Signup["status"] = game.approval ? "pending" : isFull ? "waitlist" : "confirmed";
    const payStatus: Signup["payStatus"] = game.price > 0 && status === "confirmed" ? "unpaid" : "none";

    const values = { position, guests, status, payStatus, team: null, checkedIn: false, cancelledAt: null, lateCancel: false, noShow: false };
    if (existing) {
      await db.update(signups).set({ ...values, createdAt: nowSec() }).where(eq(signups.id, existing.id));
    } else {
      await db.insert(signups).values({ gameId: game.id, userId: me.id, ...values });
    }

    if (status === "pending") {
      await notifyUsers([game.createdBy], `📥 Новая заявка на <b>${game.title}</b>: ${me.first} ${me.last}`.trim(), `/#/game/${game.id}/manage`);
    }
    return c.json({ status, payStatus });
  })

  /** Cancel my signup. Refund + waitlist promotion happen automatically. */
  .post("/:id/signup/cancel", idParam, async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    const mine = await db.query.signups.findFirst({
      where: and(eq(signups.gameId, game.id), eq(signups.userId, me.id)),
    });
    if (!mine || mine.status === "cancelled") throw new HTTPException(404, { message: "Ты не записан на эту игру" });

    const cfg = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
    const deadline = game.deadlineAt ?? game.startsAt - (cfg?.cancelDeadlineHours ?? 2) * 3600;
    const late = nowSec() > deadline;
    const wasConfirmed = mine.status === "confirmed";

    await db
      .update(signups)
      .set({ status: "cancelled", cancelledAt: nowSec(), lateCancel: wasConfirmed && late, team: null })
      .where(eq(signups.id, mine.id));

    let refunded = false;
    if (wasConfirmed && !late && (mine.payStatus === "paid" || mine.payStatus === "partial") && game.price > 0) {
      const amount = mine.payStatus === "paid" ? game.price * (1 + mine.guests) : Math.round(game.price / 2);
      // The app never moves money — the refund lands in the organizer's
      // queue and is closed once they actually transfer it back.
      await db.insert(refunds).values({
        gameId: game.id,
        userId: me.id,
        amount,
        reason: "отмена до дедлайна",
        auto: true,
      });
      refunded = true;
    }
    if (wasConfirmed) await promoteFromWaitlist(game);
    return c.json({ ok: true, refunded, late });
  })

  /** Join the waitlist of a full game. */
  .post("/:id/waitlist", idParam, zValidator("json", signupSchema), async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    assertJoinable(game);
    const existing = await db.query.signups.findFirst({
      where: and(eq(signups.gameId, game.id), eq(signups.userId, me.id)),
    });
    if (existing && existing.status !== "cancelled") throw new HTTPException(409, { message: "Ты уже в списке" });
    if (!canSeeGame(game, me, me.role === "player" ? await myGroupIds(me.id) : new Set(), existing)) {
      throw new HTTPException(404, { message: "Игра не найдена" });
    }
    const { position } = c.req.valid("json");
    const values = { position, guests: 0, status: "waitlist" as const, payStatus: "none" as const, team: null, cancelledAt: null };
    if (existing) await db.update(signups).set({ ...values, createdAt: nowSec() }).where(eq(signups.id, existing.id));
    else await db.insert(signups).values({ gameId: game.id, userId: me.id, ...values });
    return c.json({ ok: true });
  })

  /** Personal QR Platba for this game: exact amount + game as variable symbol.
      Falls back to null when the owner hasn't configured an IBAN. */
  .get("/:id/payqr", idParam, async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    const mine = await db.query.signups.findFirst({
      where: and(eq(signups.gameId, game.id), eq(signups.userId, me.id)),
    });
    const cfg = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
    if (!cfg || !looksLikeIban(cfg.qrAccount)) return c.json({ dataUrl: null, amount: 0, downloadUrl: null });
    const amount =
      mine?.payStatus === "partial" ? Math.round(game.price / 2) : game.price * (1 + (mine?.guests ?? 0));
    const payload = buildSpd({
      iban: cfg.qrAccount,
      recipient: cfg.qrRecipient || cfg.name,
      amount,
      currency: cfg.currency,
      message: buildPayMsg({
        name: `${me.first} ${me.last}`.trim(),
        handle: me.handle,
        title: game.title,
        startsAt: game.startsAt,
      }),
      vs: game.id,
    });
    const dataUrl = await QRCode.toDataURL(payload, { width: 512, margin: 2 });
    const downloadUrl = `/api/games/${game.id}/payqr.png?u=${me.id}&sig=${signQr(`game:${game.id}:${me.id}`)}`;
    return c.json({ dataUrl, amount, downloadUrl });
  })

  /** "Я оплатил" — player marks the QR transfer as done. */
  .post("/:id/mark-paid", idParam, async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    const mine = await db.query.signups.findFirst({
      where: and(eq(signups.gameId, game.id), eq(signups.userId, me.id)),
    });
    if (!mine || mine.status !== "confirmed") throw new HTTPException(404, { message: "Запись не найдена" });
    const cfg = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
    const payStatus = cfg?.qrAutoConfirm ? "paid" : "marked";
    await db.update(signups).set({ payStatus, payMethod: "qr" }).where(eq(signups.id, mine.id));
    if (!cfg?.qrAutoConfirm) {
      await notifyUsers(
        [game.createdBy],
        `💸 ${me.first} ${me.last} отметил оплату <b>${game.title}</b> — подтверди в сверке.`.trim(),
        `/#/game/${game.id}/reconcile`,
      );
    }
    return c.json({ payStatus });
  })

  /** Player asks the organizer to confirm an out-of-app payment (debts screen). */
  .post("/:id/remind-organizer", idParam, async (c) => {
    const me = c.get("user");
    const game = await loadGame(c.req.valid("param").id);
    await notifyUsers(
      [game.createdBy],
      `💬 ${me.first} ${me.last}: «Я оплатил <b>${game.title}</b>» — отметь в сверке.`.trim(),
      `/#/game/${game.id}/reconcile`,
    );
    return c.json({ ok: true });
  })

  /** Organizer decides a pending request. */
  .post(
    "/:id/approve",
    roleRequired("organizer"),
    idParam,
    zValidator("json", z.object({ userId: z.number().int().positive(), accept: z.boolean() })),
    async (c) => {
      const game = await loadGame(c.req.valid("param").id);
      const { userId, accept } = c.req.valid("json");
      const target = await db.query.signups.findFirst({
        where: and(eq(signups.gameId, game.id), eq(signups.userId, userId)),
      });
      if (!target || target.status !== "pending") throw new HTTPException(404, { message: "Заявка не найдена" });

      if (!accept) {
        await db.update(signups).set({ status: "cancelled", cancelledAt: nowSec() }).where(eq(signups.id, target.id));
        await notifyUsers([userId], `Заявка на <b>${game.title}</b> отклонена организатором.`);
        return c.json({ status: "cancelled" as const });
      }
      const all = await db.query.signups.findMany({ where: eq(signups.gameId, game.id) });
      const active = all.filter((s) => s.status !== "cancelled");
      const cap = gameCapacity(game);
      const isFull = cap > 0 && filledCount(active) + 1 + target.guests > cap;
      const status = isFull ? ("waitlist" as const) : ("confirmed" as const);
      await db
        .update(signups)
        .set({ status, payStatus: game.price > 0 && status === "confirmed" ? "unpaid" : "none" })
        .where(eq(signups.id, target.id));
      await notifyUsers(
        [userId],
        status === "confirmed"
          ? `✅ Заявка одобрена — ты в составе <b>${game.title}</b>!` +
              (game.price > 0 ? `\nВзнос ${game.price} — оплати по QR в приложении.` : "")
          : `Заявка одобрена, но состав уже полон — ты в листе ожидания <b>${game.title}</b>.`,
        status === "confirmed" && game.price > 0 ? `/#/game/${game.id}/pay` : `/#/game/${game.id}`,
      );
      return c.json({ status });
    },
  )

  /** Organizer removes a player from the roster. */
  .post(
    "/:id/kick",
    roleRequired("organizer"),
    idParam,
    zValidator("json", z.object({ userId: z.number().int().positive() })),
    async (c) => {
      const game = await loadGame(c.req.valid("param").id);
      const { userId } = c.req.valid("json");
      const target = await db.query.signups.findFirst({
        where: and(eq(signups.gameId, game.id), eq(signups.userId, userId)),
      });
      if (!target || target.status === "cancelled") throw new HTTPException(404, { message: "Игрок не найден" });
      await db.update(signups).set({ status: "cancelled", cancelledAt: nowSec(), team: null }).where(eq(signups.id, target.id));
      await notifyUsers([userId], `Организатор убрал тебя из состава <b>${game.title}</b>.`);
      await promoteFromWaitlist(game);
      return c.json({ ok: true });
    },
  )

  /** Organizer promotes a waitlisted player manually. */
  .post(
    "/:id/promote",
    roleRequired("organizer"),
    idParam,
    zValidator("json", z.object({ userId: z.number().int().positive() })),
    async (c) => {
      const game = await loadGame(c.req.valid("param").id);
      const { userId } = c.req.valid("json");
      const target = await db.query.signups.findFirst({
        where: and(eq(signups.gameId, game.id), eq(signups.userId, userId)),
      });
      if (!target || target.status !== "waitlist") throw new HTTPException(404, { message: "Игрок не в листе ожидания" });
      await db
        .update(signups)
        .set({ status: "confirmed", payStatus: game.price > 0 ? "unpaid" : "none" })
        .where(eq(signups.id, target.id));
      await notifyUsers([userId], `🎉 Ты в составе <b>${game.title}</b>!`, `/#/game/${game.id}`);
      return c.json({ ok: true });
    },
  )

  /** Organizer adds a player to the roster manually by name search. */
  .post(
    "/:id/add-player",
    roleRequired("organizer"),
    idParam,
    zValidator("json", z.object({ userId: z.number().int().positive() })),
    async (c) => {
      const game = await loadGame(c.req.valid("param").id);
      const { userId } = c.req.valid("json");
      const player = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!player) throw new HTTPException(404, { message: "Игрок не найден" });
      const existing = await db.query.signups.findFirst({
        where: and(eq(signups.gameId, game.id), eq(signups.userId, userId)),
      });
      if (existing && existing.status !== "cancelled") throw new HTTPException(409, { message: "Уже в списке" });
      const values = {
        position: player.primaryPos,
        guests: 0,
        status: "confirmed" as const,
        payStatus: game.price > 0 ? ("unpaid" as const) : ("none" as const),
        cancelledAt: null,
      };
      if (existing) await db.update(signups).set(values).where(eq(signups.id, existing.id));
      else await db.insert(signups).values({ gameId: game.id, userId, ...values });
      await notifyUsers([userId], `Организатор добавил тебя в состав <b>${game.title}</b>.`, `/#/game/${game.id}`);
      return c.json({ ok: true });
    },
  );
