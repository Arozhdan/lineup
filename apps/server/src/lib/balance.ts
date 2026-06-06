import { roleOfPosition, type TeamSide } from "@lineup/shared";

export type BalancePlayer = {
  userId: number;
  level: number;
  position: string | null;
};

/**
 * Split players into two teams balanced by skill level and role coverage.
 * Greedy snake over role buckets sorted by level: keeps both the sum of
 * levels and the GK/DEF/MID/FWD distribution close.
 */
export function autoBalance(players: BalancePlayer[]): Map<number, TeamSide> {
  const buckets = new Map<string, BalancePlayer[]>();
  for (const p of players) {
    const role = p.position ? roleOfPosition(p.position) : "mid";
    const list = buckets.get(role) ?? [];
    list.push(p);
    buckets.set(role, list);
  }

  const result = new Map<number, TeamSide>();
  let sumA = 0;
  let sumB = 0;
  let countA = 0;
  let countB = 0;

  for (const role of ["gk", "def", "mid", "fwd"]) {
    const list = (buckets.get(role) ?? []).sort((x, y) => y.level - x.level);
    for (const p of list) {
      // Weaker team (by level sum, then by headcount) picks the next best player.
      const aWeaker = sumA < sumB || (sumA === sumB && countA <= countB);
      if (aWeaker) {
        result.set(p.userId, "a");
        sumA += p.level;
        countA++;
      } else {
        result.set(p.userId, "b");
        sumB += p.level;
        countB++;
      }
    }
  }
  return result;
}
