import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { groupMembers, type Game, type Signup, type User } from "../db/schema.js";

/**
 * Can `user` see `game`? Visible when any of:
 *  - the game is public (no visibleTo restriction)
 *  - the user is an organizer/owner (admins see everything)
 *  - the user already participates (non-cancelled signup) — protects
 *    participants if group membership changes after they joined
 *  - the user belongs to at least one of the game's audience groups
 */
export function canSeeGame(
  game: Pick<Game, "visibleTo">,
  user: Pick<User, "id" | "role">,
  myGroupIds: ReadonlySet<number>,
  mySignup?: Pick<Signup, "status"> | null,
): boolean {
  if (!game.visibleTo || game.visibleTo.length === 0) return true;
  if (user.role !== "player") return true;
  if (mySignup && mySignup.status !== "cancelled") return true;
  return game.visibleTo.some((id) => myGroupIds.has(id));
}

/** Group ids the user belongs to (one query; players never see this data). */
export async function myGroupIds(userId: number): Promise<Set<number>> {
  const rows = await db.query.groupMembers.findMany({ where: eq(groupMembers.userId, userId) });
  return new Set(rows.map((r) => r.groupId));
}
