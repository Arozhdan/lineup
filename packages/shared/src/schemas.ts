import { z } from "zod";
import {
  ASIDE_OPTIONS,
  BROADCAST_AUDIENCES,
  FOOT_OPTIONS,
  GAME_KINDS,
  MODERATION_KINDS,
  PAY_METHODS,
  PAY_WHEN,
  POSITION_CODES,
  SPLIT_MODES,
  USER_ROLES,
} from "./constants.js";

export const positionSchema = z.string().refine((c) => POSITION_CODES.includes(c), "Неизвестная позиция");

export const profileSchema = z.object({
  first: z.string().trim().min(1, "Имя обязательно").max(60),
  last: z.string().trim().max(60).default(""),
  primaryPos: positionSchema.nullable(),
  fallbackPos: z.array(positionSchema).max(3),
  foot: z.enum(FOOT_OPTIONS).nullable(),
  level: z.number().int().min(1).max(5),
  area: z.string().trim().max(80).default(""),
  kitSize: z.string().trim().max(10).default(""),
});

export const settingsPatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  currency: z.string().trim().min(1).max(8).optional(),
  ptsAttend: z.number().int().min(0).max(20).optional(),
  ptsWin: z.number().int().min(0).max(20).optional(),
  ptsGoal: z.number().int().min(0).max(20).optional(),
  ptsAssist: z.number().int().min(0).max(20).optional(),
  ptsMvp: z.number().int().min(0).max(20).optional(),
  cancelDeadlineHours: z.number().int().min(0).max(72).optional(),
  noShowPenalty: z.number().int().min(0).max(50).optional(),
  minReliability: z.number().int().min(0).max(100).optional(),
  cashEnabled: z.boolean().optional(),
  qrRecipient: z.string().trim().max(120).optional(),
  qrAccount: z.string().trim().max(120).optional(),
  qrBank: z.string().trim().max(120).optional(),
  qrNote: z.string().trim().max(200).optional(),
  qrAutoConfirm: z.boolean().optional(),
  autoRefund: z.boolean().optional(),
});

const gameBase = {
  title: z.string().trim().min(1, "Название обязательно").max(120),
  startsAt: z.number().int().positive(),
  deadlineAt: z.number().int().positive().nullable().optional(),
  venueId: z.number().int().positive(),
  notes: z.string().trim().max(500).default(""),
  /** Group ids the game is visible to; null/empty = everyone. */
  visibleTo: z.array(z.number().int().positive()).max(50).nullable().default(null),
};

export const createGameSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal(GAME_KINDS[0]), // "game"
    ...gameBase,
    aside: z.number().int().refine((n) => (ASIDE_OPTIONS as readonly number[]).includes(n), "Формат 4×4–11×11"),
    subSlots: z.number().int().min(0).max(22).default(0),
    price: z.number().int().min(0).max(1_000_000).default(0),
    payWhen: z.enum(PAY_WHEN).default("signup"),
    splitMode: z.enum(SPLIT_MODES).default("auto"),
    approval: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal(GAME_KINDS[1]), // "meetup"
    ...gameBase,
    capacity: z.number().int().min(0).max(200).nullable().default(null),
    price: z.number().int().min(0).max(1_000_000).default(0),
  }),
]);

export const editGameSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  visibleTo: z.array(z.number().int().positive()).max(50).nullable().optional(),
  startsAt: z.number().int().positive().optional(),
  deadlineAt: z.number().int().positive().nullable().optional(),
  venueId: z.number().int().positive().optional(),
  notes: z.string().trim().max(500).optional(),
  subSlots: z.number().int().min(0).max(22).optional(),
  price: z.number().int().min(0).optional(),
  payWhen: z.enum(PAY_WHEN).optional(),
  splitMode: z.enum(SPLIT_MODES).optional(),
  approval: z.boolean().optional(),
  capacity: z.number().int().min(0).nullable().optional(),
});

export const signupSchema = z.object({
  position: positionSchema.nullable().default(null),
  guests: z.number().int().min(0).max(3).default(0),
});

export const venueSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно").max(120),
  addr: z.string().trim().max(200).default(""),
  rent: z.number().int().min(0).default(0),
  balls: z.number().int().min(0).default(0),
  bibs: z.number().int().min(0).default(0),
});

export const seasonSchema = z.object({
  name: z.string().trim().min(1).max(80),
  startsAt: z.number().int().positive(),
  endsAt: z.number().int().positive(),
  resetLeaderboards: z.boolean().default(true),
  keepReliability: z.boolean().default(true),
  archivePrevious: z.boolean().default(true),
});

export const seriesSchema = z.object({
  title: z.string().trim().min(1).max(120),
  days: z.array(z.number().int().min(0).max(6)).min(1, "Выбери хотя бы один день"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Время в формате ЧЧ:ММ"),
  venueId: z.number().int().positive(),
  aside: z.number().int().refine((n) => (ASIDE_OPTIONS as readonly number[]).includes(n)),
  subSlots: z.number().int().min(0).max(22).default(2),
  price: z.number().int().min(0).default(0),
  openDaysBefore: z.number().int().min(1).max(30).default(5),
  inviteRegulars: z.boolean().default(true),
  active: z.boolean().default(true),
});

export const eventSchema = z.object({
  team: z.enum(["a", "b"]),
  scorerId: z.number().int().positive().nullable(),
  assistId: z.number().int().positive().nullable(),
  ownGoal: z.boolean().default(false),
});

export const batchStatsSchema = z.object({
  rows: z
    .array(
      z.object({
        userId: z.number().int().positive(),
        goals: z.number().int().min(0).max(50),
        assists: z.number().int().min(0).max(50),
      }),
    )
    .min(1),
});

export const payStatusSchema = z.object({
  userId: z.number().int().positive(),
  payStatus: z.enum(["paid", "partial", "waived", "unpaid"]),
  payMethod: z.enum(PAY_METHODS).nullable().default(null),
});

export const complaintSchema = z.object({
  userId: z.number().int().positive(),
  gameId: z.number().int().positive().nullable().default(null),
  reason: z.string().trim().min(5, "Опиши, что случилось").max(300),
});

export const groupSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно").max(60),
});

export const moderationSchema = z.object({
  userId: z.number().int().positive(),
  kind: z.enum(MODERATION_KINDS),
  reason: z.string().trim().min(1).max(300),
});

export const broadcastSchema = z.object({
  audience: z.enum(BROADCAST_AUDIENCES),
  gameId: z.number().int().positive().nullable().default(null),
  text: z.string().trim().min(1, "Пустое сообщение").max(2000),
});

export const assignRoleSchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(USER_ROLES),
});

export const draftConfigSchema = z.object({
  captainA: z.number().int().positive(),
  captainB: z.number().int().positive(),
  pickSeconds: z.number().int().min(0).max(120).default(30),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type CreateGameInput = z.infer<typeof createGameSchema>;
export type VenueInput = z.infer<typeof venueSchema>;
