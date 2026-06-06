/** Position code → role group. Drives colors and team balancing. */
export const POSITION_ROLE: Record<string, "gk" | "def" | "mid" | "fwd"> = {
  GK: "gk",
  LB: "def", LWB: "def", CB: "def", RCB: "def", LCB: "def", RB: "def", RWB: "def",
  CDM: "mid", LDM: "mid", RDM: "mid", LM: "mid", CM: "mid", LCM: "mid", RCM: "mid", RM: "mid", CAM: "mid",
  LW: "fwd", ST: "fwd", LST: "fwd", RST: "fwd", CF: "fwd", RW: "fwd",
};

export type RoleGroup = "gk" | "def" | "mid" | "fwd";

export const POSITION_CODES = Object.keys(POSITION_ROLE);

export const roleOfPosition = (code: string): RoleGroup => POSITION_ROLE[code] ?? "mid";

/** Game formats: N-a-side, 4..11. Main slots = 2 × N. */
export const ASIDE_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11] as const;

export const GAME_KINDS = ["game", "meetup"] as const;
export type GameKind = (typeof GAME_KINDS)[number];

export const PAY_WHEN = ["signup", "approved", "after"] as const;
export type PayWhen = (typeof PAY_WHEN)[number];

export const PAY_WHEN_LABEL: Record<PayWhen, string> = {
  signup: "при записи",
  approved: "после подтверждения",
  after: "после игры",
};

export const SPLIT_MODES = ["auto", "manual", "draft"] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

export const SIGNUP_STATUSES = ["pending", "confirmed", "waitlist", "cancelled"] as const;
export type SignupStatus = (typeof SIGNUP_STATUSES)[number];

export const PAY_STATUSES = ["none", "unpaid", "marked", "paid", "partial", "waived"] as const;
export type PayStatus = (typeof PAY_STATUSES)[number];

export const PAY_STATUS_LABEL: Record<PayStatus, string> = {
  none: "—",
  unpaid: "не оплачено",
  marked: "ждёт подтверждения",
  paid: "оплачено",
  partial: "частично",
  waived: "списано",
};

export const PAY_METHODS = ["qr", "cash"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

export const USER_ROLES = ["player", "organizer", "owner"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABEL: Record<UserRole, string> = {
  player: "Игрок",
  organizer: "Организатор",
  owner: "Владелец",
};

/** Derived game card status (computed server-side). */
export const GAME_STATUSES = ["open", "filling", "full", "live", "done", "cancelled"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const FOOT_OPTIONS = ["Левая", "Правая", "Обе"] as const;

export const LEVEL_LABEL: Record<number, string> = {
  1: "Новичок",
  2: "Любитель",
  3: "Средний",
  4: "Уверенный",
  5: "Про",
};

export const TEAM_SIDES = ["a", "b"] as const;
export type TeamSide = (typeof TEAM_SIDES)[number];

export const TEAM_NAME: Record<TeamSide, string> = { a: "Светлые", b: "Тёмные" };

export const REFUND_STATUSES = ["pending", "done", "rejected"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const MODERATION_KINDS = ["warning", "ban"] as const;
export type ModerationKind = (typeof MODERATION_KINDS)[number];

export const BROADCAST_AUDIENCES = ["roster", "waitlist", "all"] as const;
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

export const BROADCAST_AUDIENCE_LABEL: Record<BroadcastAudience, string> = {
  roster: "Состав",
  waitlist: "Лист ожидания",
  all: "Все игроки",
};

export const AUDIT_ACTIONS = ["ban", "warn", "refund", "edit", "cancel", "season", "settings", "role", "venue"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
