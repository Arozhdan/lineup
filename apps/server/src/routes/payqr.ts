/**
 * Public (signature-guarded) QR Platba PNGs for saving to the gallery.
 * Telegram's downloadFile() fetches URLs without auth headers, so these
 * endpoints authenticate via an HMAC signature embedded in the URL that
 * the authed JSON endpoints hand out.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "../db/client.js";
import { games, settings, signups } from "../db/schema.js";
import { env } from "../env.js";
import { buildSpd, looksLikeIban } from "../lib/spd.js";

export const signQr = (payload: string): string =>
  createHmac("sha256", env.jwtSecret).update(`qr:${payload}`).digest("hex").slice(0, 24);

const checkSig = (payload: string, sig: string) => {
  const expected = signQr(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HTTPException(403, { message: "Недействительная ссылка" });
  }
};

const png = async (payload: string): Promise<Response> => {
  const buf = await QRCode.toBuffer(payload, { width: 768, margin: 2 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "image/png",
      "content-disposition": 'attachment; filename="qr-platba.png"',
      "cache-control": "no-store",
    },
  });
};

export const payqrPublic = new Hono()
  /** Per-game QR with the player's exact fee. */
  .get(
    "/games/:id/payqr.png",
    zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
    zValidator("query", z.object({ u: z.coerce.number().int().positive(), sig: z.string().min(10) })),
    async (c) => {
      const { id } = c.req.valid("param");
      const { u, sig } = c.req.valid("query");
      checkSig(`game:${id}:${u}`, sig);
      const game = await db.query.games.findFirst({ where: eq(games.id, id) });
      const cfg = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
      if (!game || !cfg || !looksLikeIban(cfg.qrAccount)) throw new HTTPException(404, { message: "QR недоступен" });
      const mine = await db.query.signups.findFirst({
        where: and(eq(signups.gameId, game.id), eq(signups.userId, u)),
      });
      const amount =
        mine?.payStatus === "partial" ? Math.round(game.price / 2) : game.price * (1 + (mine?.guests ?? 0));
      return png(
        buildSpd({
          iban: cfg.qrAccount,
          recipient: cfg.qrRecipient || cfg.name,
          amount,
          currency: cfg.currency,
          message: game.title,
          vs: game.id,
        }),
      );
    },
  )

  /** Total-debt QR (Платежи и долги). Amount is computed fresh on download. */
  .get(
    "/money/debtqr.png",
    zValidator("query", z.object({ u: z.coerce.number().int().positive(), sig: z.string().min(10) })),
    async (c) => {
      const { u, sig } = c.req.valid("query");
      checkSig(`debt:${u}`, sig);
      const cfg = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
      if (!cfg || !looksLikeIban(cfg.qrAccount)) throw new HTTPException(404, { message: "QR недоступен" });

      const mine = (await db.query.signups.findMany({ where: eq(signups.userId, u) })).filter(
        (s) => s.status === "confirmed",
      );
      let debt = 0;
      for (const s of mine) {
        const g = await db.query.games.findFirst({ where: eq(games.id, s.gameId) });
        if (!g || g.price === 0 || g.cancelledAt) continue;
        const fee = g.price * (1 + s.guests);
        if (s.payStatus === "unpaid") debt += fee;
        if (s.payStatus === "partial") debt += Math.round(fee / 2);
      }
      return png(
        buildSpd({
          iban: cfg.qrAccount,
          recipient: cfg.qrRecipient || cfg.name,
          amount: debt || undefined,
          currency: cfg.currency,
          message: `Взносы · ${cfg.name}`,
        }),
      );
    },
  );
