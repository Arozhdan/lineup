import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { gameStats, games, mvpVotes, seasons, settings, signups } from "../db/schema.js";
import { aggregatePlayers, aggregateReliability, type PlayerAggregate, type ReliabilityRow } from "./stats.js";

export type SeasonData = {
  season: typeof seasons.$inferSelect | null;
  aggregates: Map<number, PlayerAggregate>;
  reliability: Map<number, ReliabilityRow>;
  finishedCount: number;
};

/** Load and aggregate everything needed for stats/leaderboards of the active season. */
export async function activeSeasonData(): Promise<SeasonData> {
  const season = (await db.query.seasons.findFirst({ where: eq(seasons.active, true) })) ?? null;
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

  return {
    season,
    aggregates: aggregatePlayers(finished, seasonSignups, stats, votes, cfg),
    reliability: aggregateReliability(finishedIds, allSignups),
    finishedCount: finished.length,
  };
}
