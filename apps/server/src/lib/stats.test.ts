import { describe, expect, it } from "vitest";
import { aggregatePlayers, aggregateReliability, mvpWinners, statsFromEvents } from "./stats.js";
import type { Game, MatchEvent, Settings, Signup } from "../db/schema.js";

const cfg = {
  ptsAttend: 2,
  ptsWin: 3,
  ptsGoal: 1,
  ptsAssist: 1,
  ptsMvp: 2,
  noShowPenalty: 5,
} as Settings;

const game = (id: number, scoreA: number, scoreB: number, startsAt = id): Game =>
  ({ id, scoreA, scoreB, startsAt, finishedAt: startsAt + 1 }) as Game;

const signup = (gameId: number, userId: number, team: "a" | "b", extra: Partial<Signup> = {}): Signup =>
  ({ gameId, userId, team, status: "confirmed", checkedIn: true, noShow: false, lateCancel: false, ...extra }) as Signup;

describe("aggregatePlayers", () => {
  it("scores attendance + win + goals", () => {
    const games = [game(1, 2, 1)];
    const signups = [signup(1, 10, "a"), signup(1, 20, "b")];
    const stats = [{ gameId: 1, userId: 10, goals: 2, assists: 0, confirmed: true }];
    const agg = aggregatePlayers(games, signups, stats, [], cfg);
    // 2 attend + 3 win + 2 goals = 7
    expect(agg.get(10)!.points).toBe(7);
    expect(agg.get(10)!.wins).toBe(1);
    expect(agg.get(20)!.losses).toBe(1);
    expect(agg.get(20)!.points).toBe(2);
  });

  it("adds MVP bonus to the vote winner", () => {
    const games = [game(1, 1, 1)];
    const signups = [signup(1, 10, "a"), signup(1, 20, "b")];
    const votes = [
      { gameId: 1, voteeId: 10 },
      { gameId: 1, voteeId: 10 },
      { gameId: 1, voteeId: 20 },
    ];
    const agg = aggregatePlayers(games, signups, [], votes, cfg);
    expect(agg.get(10)!.mvp).toBe(1);
    expect(agg.get(10)!.points).toBe(2 + 2); // attend + mvp (draw → no win pts)
    expect(agg.get(20)!.mvp).toBe(0);
  });

  it("penalises no-shows", () => {
    const games = [game(1, 1, 0)];
    const signups = [signup(1, 10, "a", { checkedIn: false, noShow: true })];
    const agg = aggregatePlayers(games, signups, [], [], cfg);
    expect(agg.get(10)!.points).toBe(-5);
    expect(agg.get(10)!.games).toBe(0);
  });

  it("tracks form and streak", () => {
    const games = [game(1, 1, 0, 1), game(2, 0, 1, 2), game(3, 2, 0, 3)];
    const signups = [signup(1, 10, "a"), signup(2, 10, "a"), signup(3, 10, "a")];
    const agg = aggregatePlayers(games, signups, [], [], cfg);
    expect(agg.get(10)!.form).toEqual(["W", "L", "W"]);
    expect(agg.get(10)!.streak).toBe(1);
  });
});

describe("aggregateReliability", () => {
  it("computes attendance ratio with late cancels and no-shows", () => {
    const finished = new Set([1, 2, 3]);
    const signups = [
      signup(1, 10, "a"),
      signup(2, 10, "a", { noShow: true, checkedIn: false }),
      signup(3, 10, "a"),
      { gameId: 4, userId: 10, status: "cancelled", lateCancel: true } as Signup,
    ];
    const rel = aggregateReliability(finished, signups);
    expect(rel.get(10)!.signups).toBe(4);
    expect(rel.get(10)!.attended).toBe(2);
    expect(rel.get(10)!.reliability).toBe(50);
  });
});

describe("aggregateReliability penalties", () => {
  it("counts each penalty as a missed attendance", () => {
    const finished = new Set([1, 2, 3]);
    const signupRows = [signup(1, 10, "a"), signup(2, 10, "a"), signup(3, 10, "a")];
    const rel = aggregateReliability(finished, signupRows, new Map([[10, 1]]));
    // 3 attended of (3 signups + 1 penalty) = 75%
    expect(rel.get(10)!.reliability).toBe(75);
    expect(rel.get(10)!.penalties).toBe(1);
  });

  it("creates a row for a player with only penalties", () => {
    const rel = aggregateReliability(new Set(), [], new Map([[7, 2]]));
    expect(rel.get(7)!.reliability).toBe(0);
  });
});

describe("mvpWinners", () => {
  it("picks the most voted player per game", () => {
    const winners = mvpWinners([
      { gameId: 1, voteeId: 5 },
      { gameId: 1, voteeId: 6 },
      { gameId: 1, voteeId: 6 },
      { gameId: 2, voteeId: 7 },
    ]);
    expect(winners.get(1)).toBe(6);
    expect(winners.get(2)).toBe(7);
  });
});

describe("statsFromEvents", () => {
  it("counts goals and assists, ignoring own goals", () => {
    const events = [
      { scorerId: 1, assistId: 2, ownGoal: false },
      { scorerId: 1, assistId: null, ownGoal: false },
      { scorerId: null, assistId: null, ownGoal: true },
    ] as MatchEvent[];
    const stats = statsFromEvents(events);
    expect(stats.get(1)).toEqual({ goals: 2, assists: 0 });
    expect(stats.get(2)).toEqual({ goals: 0, assists: 1 });
  });
});
