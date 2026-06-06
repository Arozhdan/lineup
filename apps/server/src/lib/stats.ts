import type { Game, MatchEvent, Settings, Signup } from "../db/schema.js";

export type GameStatRow = { gameId: number; userId: number; goals: number; assists: number; confirmed: boolean };
export type MvpVoteRow = { gameId: number; voteeId: number };

export type PlayerAggregate = {
  userId: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  mvp: number;
  points: number;
  /** W/D/L of the most recent games, oldest → newest, max 5. */
  form: string[];
  streak: number;
};

export type ReliabilityRow = {
  userId: number;
  signups: number;
  attended: number;
  lateCancels: number;
  noShows: number;
  reliability: number;
};

const winnerOf = (g: Game): "a" | "b" | null => (g.scoreA > g.scoreB ? "a" : g.scoreB > g.scoreA ? "b" : null);

/** MVP winners per game: votee with the most votes (ties → first reached). */
export function mvpWinners(votes: MvpVoteRow[]): Map<number, number> {
  const tally = new Map<number, Map<number, number>>();
  for (const v of votes) {
    const m = tally.get(v.gameId) ?? new Map<number, number>();
    m.set(v.voteeId, (m.get(v.voteeId) ?? 0) + 1);
    tally.set(v.gameId, m);
  }
  const winners = new Map<number, number>();
  for (const [gameId, m] of tally) {
    let best = 0;
    let bestUser = 0;
    for (const [userId, n] of m) {
      if (n > best) {
        best = n;
        bestUser = userId;
      }
    }
    if (bestUser) winners.set(gameId, bestUser);
  }
  return winners;
}

/**
 * Season aggregates per player over finished games: record, goals/assists,
 * MVP count and leaderboard points per the settings' scoring config.
 */
export function aggregatePlayers(
  finishedGames: Game[],
  allSignups: Signup[],
  stats: GameStatRow[],
  votes: MvpVoteRow[],
  cfg: Settings,
): Map<number, PlayerAggregate> {
  const byGame = new Map<number, Signup[]>();
  for (const s of allSignups) {
    if (s.status !== "confirmed") continue;
    const list = byGame.get(s.gameId) ?? [];
    list.push(s);
    byGame.set(s.gameId, list);
  }
  const statByGameUser = new Map<string, GameStatRow>();
  for (const st of stats) if (st.confirmed) statByGameUser.set(`${st.gameId}:${st.userId}`, st);
  const winners = mvpWinners(votes);

  const out = new Map<number, PlayerAggregate>();
  const get = (userId: number): PlayerAggregate => {
    let a = out.get(userId);
    if (!a) {
      a = { userId, games: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, mvp: 0, points: 0, form: [], streak: 0 };
      out.set(userId, a);
    }
    return a;
  };

  const ordered = [...finishedGames].sort((x, y) => x.startsAt - y.startsAt);
  for (const g of ordered) {
    const win = winnerOf(g);
    const mvpUser = winners.get(g.id);
    for (const s of byGame.get(g.id) ?? []) {
      const a = get(s.userId);
      if (s.noShow) {
        a.points -= cfg.noShowPenalty;
        continue;
      }
      if (!s.checkedIn) continue;
      a.games++;
      a.points += cfg.ptsAttend;
      const st = statByGameUser.get(`${g.id}:${s.userId}`);
      if (st) {
        a.goals += st.goals;
        a.assists += st.assists;
        a.points += st.goals * cfg.ptsGoal + st.assists * cfg.ptsAssist;
      }
      if (mvpUser === s.userId) {
        a.mvp++;
        a.points += cfg.ptsMvp;
      }
      let r: "W" | "D" | "L" = "D";
      if (s.team && win) r = s.team === win ? "W" : "L";
      else if (win === null) r = "D";
      if (r === "W") {
        a.wins++;
        a.points += cfg.ptsWin;
      } else if (r === "L") a.losses++;
      else a.draws++;
      a.form.push(r);
    }
  }
  for (const a of out.values()) {
    let streak = 0;
    for (let i = a.form.length - 1; i >= 0 && a.form[i] !== "L"; i--) streak++;
    a.streak = streak;
    a.form = a.form.slice(-5);
  }
  return out;
}

/** Attendance reliability across finished games (not season-scoped). */
export function aggregateReliability(finishedGameIds: Set<number>, allSignups: Signup[]): Map<number, ReliabilityRow> {
  const out = new Map<number, ReliabilityRow>();
  const get = (userId: number): ReliabilityRow => {
    let r = out.get(userId);
    if (!r) {
      r = { userId, signups: 0, attended: 0, lateCancels: 0, noShows: 0, reliability: 100 };
      out.set(userId, r);
    }
    return r;
  };
  for (const s of allSignups) {
    if (s.status === "cancelled" && s.lateCancel) {
      const r = get(s.userId);
      r.signups++;
      r.lateCancels++;
      continue;
    }
    if (s.status !== "confirmed" || !finishedGameIds.has(s.gameId)) continue;
    const r = get(s.userId);
    r.signups++;
    if (s.noShow) r.noShows++;
    else if (s.checkedIn) r.attended++;
    else r.attended++; // confirmed on a finished game without explicit check-in counts as attended
  }
  for (const r of out.values()) {
    r.reliability = r.signups ? Math.round((100 * r.attended) / r.signups) : 100;
  }
  return out;
}

/** Rebuild per-player confirmed stats from the live-match event log. */
export function statsFromEvents(events: MatchEvent[]): Map<number, { goals: number; assists: number }> {
  const out = new Map<number, { goals: number; assists: number }>();
  const get = (userId: number) => {
    let s = out.get(userId);
    if (!s) {
      s = { goals: 0, assists: 0 };
      out.set(userId, s);
    }
    return s;
  };
  for (const e of events) {
    if (e.ownGoal || !e.scorerId) continue;
    get(e.scorerId).goals++;
    if (e.assistId) get(e.assistId).assists++;
  }
  return out;
}
