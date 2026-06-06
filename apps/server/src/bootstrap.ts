import { eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { games, seasons, series, settings } from "./db/schema.js";
import { nowSec } from "./lib/serialize.js";

/** Ensure the singleton settings row and an active season exist. */
export async function bootstrap(): Promise<void> {
  const cfg = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
  if (!cfg) await db.insert(settings).values({ id: 1, name: "Lineup" });

  const active = await db.query.seasons.findFirst({ where: eq(seasons.active, true) });
  if (!active) {
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.floor(now.getMonth() / 3);
    const names = ["Зима", "Весна", "Лето", "Осень"];
    const start = Math.floor(new Date(year, quarter * 3, 1).getTime() / 1000);
    const end = Math.floor(new Date(year, quarter * 3 + 3, 0, 23, 59).getTime() / 1000);
    await db.insert(seasons).values({ name: `${names[quarter]} ${year}`, startsAt: start, endsAt: end, active: true });
  }
}

/** Create upcoming games for active recurring series (idempotent). */
export async function generateSeriesGames(): Promise<void> {
  const activeSeries = (await db.query.series.findMany()).filter((s) => s.active);
  if (!activeSeries.length) return;
  const season = await db.query.seasons.findFirst({ where: eq(seasons.active, true) });

  for (const s of activeSeries) {
    const existing = await db.query.games.findMany({ where: eq(games.seriesId, s.id) });
    const existingTimes = new Set(existing.map((g) => g.startsAt));
    const [hh = 18, mm = 0] = s.time.split(":").map(Number);

    for (let dayOffset = 0; dayOffset <= s.openDaysBefore; dayOffset++) {
      const d = new Date();
      d.setDate(d.getDate() + dayOffset);
      // JS getDay(): 0=Sunday; series days use 0=Monday … 6=Sunday.
      const weekday = (d.getDay() + 6) % 7;
      if (!s.days.includes(weekday)) continue;
      d.setHours(hh, mm, 0, 0);
      const startsAt = Math.floor(d.getTime() / 1000);
      if (startsAt <= nowSec() || existingTimes.has(startsAt)) continue;
      await db.insert(games).values({
        kind: "game",
        title: s.title,
        startsAt,
        deadlineAt: startsAt - 2 * 3600,
        venueId: s.venueId,
        aside: s.aside,
        mainSlots: s.aside * 2,
        subSlots: s.subSlots,
        price: s.price,
        payWhen: "signup",
        splitMode: "auto",
        seasonId: season?.id ?? null,
        seriesId: s.id,
        createdBy: 1,
      });
    }
  }
}
