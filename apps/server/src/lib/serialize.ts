import type { GameStatus } from "@lineup/shared";
import type { Game, Signup, User, Venue } from "../db/schema.js";

export const nowSec = (): number => Math.floor(Date.now() / 1000);

export const gameCapacity = (g: Game): number =>
  g.kind === "meetup" ? (g.capacity ?? 0) : g.mainSlots + g.subSlots;

/** Count of taken spots: confirmed players + their guests. */
export const filledCount = (signups: Signup[]): number =>
  signups.filter((s) => s.status === "confirmed").reduce((sum, s) => sum + 1 + s.guests, 0);

export function gameStatus(g: Game, filled: number): GameStatus {
  if (g.cancelledAt) return "cancelled";
  if (g.finishedAt) return "done";
  if (g.startedAt) return "live";
  const cap = gameCapacity(g);
  if (cap > 0 && filled >= cap) return "full";
  if (cap > 0 && filled / cap >= 0.6) return "filling";
  return "open";
}

export type PublicUser = {
  id: number;
  name: string;
  first: string;
  last: string;
  handle: string;
  photoUrl: string;
  primaryPos: string | null;
  fallbackPos: string[];
  level: number;
  role: User["role"];
};

export const publicUser = (u: User): PublicUser => ({
  id: u.id,
  name: `${u.first} ${u.last}`.trim(),
  first: u.first,
  last: u.last,
  handle: u.handle,
  photoUrl: u.photoUrl,
  primaryPos: u.primaryPos,
  fallbackPos: u.fallbackPos,
  level: u.level,
  role: u.role,
});

export function gameCard(g: Game, signups: Signup[], venue: Venue | undefined, myUserId: number) {
  const active = signups.filter((s) => s.status !== "cancelled");
  const filled = filledCount(active);
  const mine = active.find((s) => s.userId === myUserId);
  return {
    id: g.id,
    kind: g.kind,
    title: g.title,
    startsAt: g.startsAt,
    deadlineAt: g.deadlineAt,
    venue: venue?.name ?? "",
    venueShort: venue ? venue.name.split(",")[0]! : "",
    aside: g.aside,
    format: g.kind === "meetup" ? "Митап" : `${g.aside}×${g.aside}`,
    mainSlots: g.mainSlots,
    subSlots: g.subSlots,
    capacity: gameCapacity(g),
    price: g.price,
    payWhen: g.payWhen,
    approval: g.approval,
    splitMode: g.splitMode,
    notes: g.notes,
    filled,
    status: gameStatus(g, filled),
    scoreA: g.scoreA,
    scoreB: g.scoreB,
    teamsPublished: !!g.teamsPublishedAt,
    youIn: !!mine && mine.status === "confirmed",
    myStatus: mine?.status ?? null,
    myPosition: mine?.position ?? null,
  };
}

export type GameCard = ReturnType<typeof gameCard>;
