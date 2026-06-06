import { describe, expect, it } from "vitest";
import { autoBalance } from "./balance.js";

const player = (userId: number, level: number, position: string | null) => ({ userId, level, position });

describe("autoBalance", () => {
  it("splits players evenly by headcount", () => {
    const players = Array.from({ length: 10 }, (_, i) => player(i + 1, 3, "CM"));
    const split = autoBalance(players);
    const a = [...split.values()].filter((t) => t === "a").length;
    expect(a).toBe(5);
    expect(split.size).toBe(10);
  });

  it("keeps level sums close", () => {
    const players = [5, 5, 4, 4, 3, 3, 2, 2, 1, 1].map((lvl, i) => player(i + 1, lvl, "CM"));
    const split = autoBalance(players);
    const sum = (team: "a" | "b") =>
      players.filter((p) => split.get(p.userId) === team).reduce((s, p) => s + p.level, 0);
    expect(Math.abs(sum("a") - sum("b"))).toBeLessThanOrEqual(1);
  });

  it("separates two goalkeepers", () => {
    const players = [player(1, 3, "GK"), player(2, 3, "GK"), ...Array.from({ length: 8 }, (_, i) => player(i + 3, 3, "ST"))];
    const split = autoBalance(players);
    expect(split.get(1)).not.toBe(split.get(2));
  });
});
