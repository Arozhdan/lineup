import { describe, expect, it } from "vitest";
import { canSeeGame } from "./visibility.js";

const player = { id: 1, role: "player" as const };
const organizer = { id: 2, role: "organizer" as const };
const none = new Set<number>();

describe("canSeeGame", () => {
  it("public games are visible to everyone", () => {
    expect(canSeeGame({ visibleTo: null }, player, none)).toBe(true);
    expect(canSeeGame({ visibleTo: [] }, player, none)).toBe(true);
  });

  it("admins see restricted games", () => {
    expect(canSeeGame({ visibleTo: [5] }, organizer, none)).toBe(true);
  });

  it("group members see restricted games", () => {
    expect(canSeeGame({ visibleTo: [5, 6] }, player, new Set([6]))).toBe(true);
  });

  it("strangers do not see restricted games", () => {
    expect(canSeeGame({ visibleTo: [5] }, player, new Set([7]))).toBe(false);
    expect(canSeeGame({ visibleTo: [5] }, player, none)).toBe(false);
  });

  it("participants keep access after leaving the group", () => {
    expect(canSeeGame({ visibleTo: [5] }, player, none, { status: "confirmed" })).toBe(true);
    expect(canSeeGame({ visibleTo: [5] }, player, none, { status: "waitlist" })).toBe(true);
    expect(canSeeGame({ visibleTo: [5] }, player, none, { status: "cancelled" })).toBe(false);
  });
});
