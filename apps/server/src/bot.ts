import { Bot, GrammyError, InlineKeyboard } from "grammy";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db/client.js";
import { games, settings, signups, users, venues } from "./db/schema.js";
import { env } from "./env.js";
import { fmtDateTime } from "./lib/dates.js";

export const bot: Bot | null = env.botToken ? new Bot(env.botToken) : null;

const openAppKeyboard = (path = "") =>
  new InlineKeyboard().webApp("⚽ Открыть Lineup", `${env.webappUrl}${path}`);

export async function startBot(): Promise<void> {
  if (!bot) {
    console.log("[bot] BOT_TOKEN not set — bot disabled");
    return;
  }

  bot.command("start", async (ctx) => {
    const cfg = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
    await ctx.reply(
      `Привет! Это <b>${cfg?.name ?? "Lineup"}</b> — запись на футбол прямо в Telegram.\n\n` +
        "Открой мини-приложение, выбери игру, позицию на поле — и на поле!",
      { parse_mode: "HTML", reply_markup: openAppKeyboard() },
    );
  });

  bot.command("games", async (ctx) => {
    await ctx.reply("Ближайшие игры — в приложении:", { reply_markup: openAppKeyboard() });
  });

  bot.catch((err) => {
    console.error("[bot] error:", err.message);
  });

  // Menu button under the message input opens the mini app for everyone.
  try {
    await bot.api.setChatMenuButton({
      menu_button: { type: "web_app", text: "Lineup", web_app: { url: env.webappUrl } },
    });
    await bot.api.setMyCommands([
      { command: "start", description: "Открыть Lineup" },
      { command: "games", description: "Ближайшие игры" },
    ]);
  } catch (e) {
    console.error("[bot] setup failed:", e);
  }

  void bot.start({ onStart: (me) => console.log(`[bot] @${me.username} polling`) });
}

/** Send a message to a set of internal user ids; returns delivered count. */
export async function notifyUsers(userIds: number[], text: string, appPath = ""): Promise<number> {
  if (!bot || userIds.length === 0) return 0;
  const rows = await db.select({ tgId: users.tgId }).from(users).where(inArray(users.id, userIds));
  let sent = 0;
  for (const r of rows) {
    try {
      await bot.api.sendMessage(r.tgId, text, { parse_mode: "HTML", reply_markup: openAppKeyboard(appPath) });
      sent++;
    } catch (e) {
      // Users who blocked the bot are expected; skip silently.
      if (!(e instanceof GrammyError && (e.error_code === 403 || e.error_code === 400))) {
        console.error("[bot] notify failed:", e);
      }
    }
  }
  return sent;
}

/** Confirmed roster (without guests) of a game. */
export async function rosterUserIds(gameId: number): Promise<number[]> {
  const rows = await db.query.signups.findMany({ where: eq(signups.gameId, gameId) });
  return rows.filter((s) => s.status === "confirmed").map((s) => s.userId);
}

/** Background loop: remind rosters 2 hours before kick-off, once per game. */
export function startReminderLoop(): void {
  const tick = async () => {
    const now = Math.floor(Date.now() / 1000);
    const all = await db.query.games.findMany();
    const due = all.filter(
      (g) => !g.cancelledAt && !g.finishedAt && !g.remindedAt && g.startsAt - now <= 2 * 3600 && g.startsAt > now,
    );
    for (const g of due) {
      await db.update(games).set({ remindedAt: now }).where(eq(games.id, g.id));
      const venue = await db.query.venues.findFirst({ where: eq(venues.id, g.venueId) });
      const ids = await rosterUserIds(g.id);
      await notifyUsers(
        ids,
        `⏰ Напоминание: <b>${g.title}</b> сегодня в ${fmtDateTime(g.startsAt).split(", ")[1]}` +
          (venue ? `\n📍 ${venue.name}` : "") +
          "\n\nЧек-ин откроется на поле.",
        `/#/game/${g.id}`,
      );
    }
  };
  setInterval(() => void tick().catch((e) => console.error("[reminders]", e)), 60_000);
}
