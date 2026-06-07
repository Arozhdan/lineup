import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { gameStats, games, moderation, mvpVotes, seasons, settings, signups } from "../db/schema.js";
import { aggregatePlayers, aggregateReliability, type PlayerAggregate, type ReliabilityRow } from "./stats.js";

export type SeasonData = {
  season: typeof seasons.$inferSelect | null;
  aggregates: Map<number, PlayerAggregate>;
  reliability: Map<number, ReliabilityRow>;
  finishedCount: number;
};

/** Load and aggregate stats/leaderboards for one season (default: the active one). */
export async function seasonData(seasonId: number | null = null): Promise<SeasonData> {
  const season = seasonId
    ? ((await db.query.seasons.findFirst({ where: eq(seasons.id, seasonId) })) ?? null)
    : ((await db.query.seasons.findFirst({ where: eq(seasons.active, true) })) ?? null);
  const cfg = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
  if (!cfg) throw new Error("settings row missing");

  const allGames = await db.query.games.findMany();
  const finishedAll = allGames.filter((g) => g.finishedAt && !g.cancelledAt);
  const finished = season ? finishedAll.filter((g) => g.seasonId === season.id) : finishedAll;

  const gameIds = finished.map((g) => g.id);
  const seasonSignups = gameIds.length ? await db.query.signups.findMany({ where: inArray(signups.gameId, gameIds) }) : [];
  const stats = gameIds.length ? await db.query.gameStats.findMany({ where: inArray(gameStats.gameId, gameIds) }) : [];
  const votes = gameIds.length ? await db.query.mvpVotes.findMany({ where: inArray(mvpVotes.gameId, gameIds) }) : [];

  // Reliability spans the whole history, not just the season.
  const allSignups = await db.query.signups.findMany();
  const finishedIds = new Set(finishedAll.map((g) => g.id));
  // Active (not lifted) moderation penalties each count as a missed attendance.
  const penaltyRows = await db.query.moderation.findMany();
  const penalties = new Map<number, number>();
  for (const row of penaltyRows) {
    if (row.kind === "penalty" && !row.liftedAt) penalties.set(row.userId, (penalties.get(row.userId) ?? 0) + 1);
  }

  return {
    season,
    aggregates: aggregatePlayers(finished, seasonSignups, stats, votes, cfg),
    reliability: aggregateReliability(finishedIds, allSignups, penalties),
    finishedCount: finished.length,
  };
}

/** Back-compat alias: aggregates for the active season. */
export const activeSeasonData = (): Promise<SeasonData> => seasonData(null);
