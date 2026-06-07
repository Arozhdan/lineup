import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch())`;

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tgId: integer("tg_id").notNull(),
    first: text("first").notNull().default(""),
    last: text("last").notNull().default(""),
    handle: text("handle").notNull().default(""),
    photoUrl: text("photo_url").notNull().default(""),
    primaryPos: text("primary_pos"),
    fallbackPos: text("fallback_pos", { mode: "json" }).$type<string[]>().notNull().default([]),
    foot: text("foot"),
    level: integer("level").notNull().default(3),
    area: text("area").notNull().default(""),
    kitSize: text("kit_size").notNull().default(""),
    role: text("role").$type<"player" | "organizer" | "owner">().notNull().default("player"),
    onboardedAt: integer("onboarded_at"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("users_tg_id").on(t.tgId)],
);

/** Single-row platform settings (id = 1). */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().default("Lineup"),
  currency: text("currency").notNull().default("Kč"),
  ptsAttend: integer("pts_attend").notNull().default(2),
  ptsWin: integer("pts_win").notNull().default(3),
  ptsGoal: integer("pts_goal").notNull().default(1),
  ptsAssist: integer("pts_assist").notNull().default(1),
  ptsMvp: integer("pts_mvp").notNull().default(2),
  cancelDeadlineHours: integer("cancel_deadline_hours").notNull().default(2),
  noShowPenalty: integer("no_show_penalty").notNull().default(5),
  minReliability: integer("min_reliability").notNull().default(0),
  cashEnabled: integer("cash_enabled", { mode: "boolean" }).notNull().default(true),
  qrRecipient: text("qr_recipient").notNull().default(""),
  qrAccount: text("qr_account").notNull().default(""),
  qrBank: text("qr_bank").notNull().default(""),
  qrNote: text("qr_note").notNull().default("Взнос за игру · {название}"),
  qrImage: text("qr_image").notNull().default(""),
  qrAutoConfirm: integer("qr_auto_confirm", { mode: "boolean" }).notNull().default(false),
  autoRefund: integer("auto_refund", { mode: "boolean" }).notNull().default(true),
});

/** Admin-only audiences. Players never see groups or their membership. */
export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull().default(now),
});

export const groupMembers = sqliteTable(
  "group_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupId: integer("group_id").notNull(),
    userId: integer("user_id").notNull(),
  },
  (t) => [uniqueIndex("group_members_pair").on(t.groupId, t.userId)],
);

export const venues = sqliteTable("venues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  addr: text("addr").notNull().default(""),
  rent: integer("rent").notNull().default(0),
  balls: integer("balls").notNull().default(0),
  bibs: integer("bibs").notNull().default(0),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

export const seasons = sqliteTable("seasons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  startsAt: integer("starts_at").notNull(),
  endsAt: integer("ends_at").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

export const series = sqliteTable("series", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  days: text("days", { mode: "json" }).$type<number[]>().notNull().default([]),
  time: text("time").notNull().default("18:00"),
  venueId: integer("venue_id").notNull(),
  aside: integer("aside").notNull().default(5),
  subSlots: integer("sub_slots").notNull().default(2),
  price: integer("price").notNull().default(0),
  openDaysBefore: integer("open_days_before").notNull().default(5),
  inviteRegulars: integer("invite_regulars", { mode: "boolean" }).notNull().default(true),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export type DraftState = {
  captainA: number;
  captainB: number;
  pickSeconds: number;
  turn: "a" | "b";
  /** Unix seconds when the current turn expires (null = no limit). */
  turnEndsAt: number | null;
  startedAt: number;
} | null;

export const games = sqliteTable(
  "games",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").$type<"game" | "meetup">().notNull().default("game"),
    title: text("title").notNull(),
    startsAt: integer("starts_at").notNull(),
    deadlineAt: integer("deadline_at"),
    venueId: integer("venue_id").notNull(),
    aside: integer("aside"),
    mainSlots: integer("main_slots").notNull().default(0),
    subSlots: integer("sub_slots").notNull().default(0),
    capacity: integer("capacity"),
    price: integer("price").notNull().default(0),
    payWhen: text("pay_when").$type<"signup" | "approved" | "after">().notNull().default("signup"),
    splitMode: text("split_mode").$type<"auto" | "manual" | "draft">().notNull().default("auto"),
    approval: integer("approval", { mode: "boolean" }).notNull().default(false),
    notes: text("notes").notNull().default(""),
    cancelledAt: integer("cancelled_at"),
    startedAt: integer("started_at"),
    pausedAt: integer("paused_at"),
    /** Accumulated paused seconds, so the match clock survives pauses. */
    pausedTotal: integer("paused_total").notNull().default(0),
    finishedAt: integer("finished_at"),
    scoreA: integer("score_a").notNull().default(0),
    scoreB: integer("score_b").notNull().default(0),
    teamsPublishedAt: integer("teams_published_at"),
    /** Group ids the game is visible to; null/empty = everyone. */
    visibleTo: text("visible_to", { mode: "json" }).$type<number[] | null>(),
    draft: text("draft", { mode: "json" }).$type<DraftState>(),
    remindedAt: integer("reminded_at"),
    seasonId: integer("season_id"),
    seriesId: integer("series_id"),
    createdBy: integer("created_by").notNull(),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("games_starts_at").on(t.startsAt), index("games_series").on(t.seriesId)],
);

export const signups = sqliteTable(
  "signups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull(),
    userId: integer("user_id").notNull(),
    position: text("position"),
    guests: integer("guests").notNull().default(0),
    status: text("status").$type<"pending" | "confirmed" | "waitlist" | "cancelled">().notNull(),
    team: text("team").$type<"a" | "b" | null>(),
    payStatus: text("pay_status").$type<"none" | "unpaid" | "marked" | "paid" | "partial" | "waived">().notNull().default("none"),
    payMethod: text("pay_method").$type<"qr" | "cash" | null>(),
    checkedIn: integer("checked_in", { mode: "boolean" }).notNull().default(false),
    lateCancel: integer("late_cancel", { mode: "boolean" }).notNull().default(false),
    noShow: integer("no_show", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().default(now),
    cancelledAt: integer("cancelled_at"),
  },
  (t) => [uniqueIndex("signups_game_user").on(t.gameId, t.userId), index("signups_user").on(t.userId)],
);

export const matchEvents = sqliteTable(
  "match_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull(),
    minute: integer("minute").notNull().default(0),
    team: text("team").$type<"a" | "b">().notNull(),
    scorerId: integer("scorer_id"),
    assistId: integer("assist_id"),
    ownGoal: integer("own_goal", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("events_game").on(t.gameId)],
);

export const gameStats = sqliteTable(
  "game_stats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull(),
    userId: integer("user_id").notNull(),
    goals: integer("goals").notNull().default(0),
    assists: integer("assists").notNull().default(0),
    source: text("source").$type<"self" | "organizer">().notNull().default("organizer"),
    confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [uniqueIndex("stats_game_user").on(t.gameId, t.userId)],
);

export const mvpVotes = sqliteTable(
  "mvp_votes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull(),
    voterId: integer("voter_id").notNull(),
    voteeId: integer("votee_id").notNull(),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("mvp_game_voter").on(t.gameId, t.voterId)],
);

export const moderation = sqliteTable("moderation", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  kind: text("kind").$type<"warning" | "ban" | "penalty">().notNull(),
  reason: text("reason").notNull().default(""),
  byId: integer("by_id").notNull(),
  liftedAt: integer("lifted_at"),
  createdAt: integer("created_at").notNull().default(now),
});

export const complaints = sqliteTable(
  "complaints",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    aboutId: integer("about_id").notNull(),
    byId: integer("by_id").notNull(),
    gameId: integer("game_id"),
    reason: text("reason").notNull(),
    status: text("status").$type<"open" | "resolved" | "dismissed">().notNull().default("open"),
    createdAt: integer("created_at").notNull().default(now),
    resolvedAt: integer("resolved_at"),
  },
  (t) => [index("complaints_about").on(t.aboutId)],
);

export const refunds = sqliteTable("refunds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id").notNull(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull().default(""),
  auto: integer("auto", { mode: "boolean" }).notNull().default(false),
  status: text("status").$type<"pending" | "done" | "rejected">().notNull().default("pending"),
  createdAt: integer("created_at").notNull().default(now),
  decidedAt: integer("decided_at"),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorId: integer("actor_id").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull().default(""),
  reason: text("reason").notNull().default(""),
  createdAt: integer("created_at").notNull().default(now),
});

export const photos = sqliteTable(
  "photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull(),
    userId: integer("user_id").notNull(),
    path: text("path").notNull(),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("photos_game").on(t.gameId)],
);

export const broadcasts = sqliteTable("broadcasts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  byId: integer("by_id").notNull(),
  audience: text("audience").notNull(),
  gameId: integer("game_id"),
  text: text("text").notNull(),
  sentTo: integer("sent_to").notNull().default(0),
  createdAt: integer("created_at").notNull().default(now),
});

export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Signup = typeof signups.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type MatchEvent = typeof matchEvents.$inferSelect;
