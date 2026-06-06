/**
 * Dev seed: demo community mirroring the design prototype's data.
 * Run with `pnpm db:seed`. Idempotent-ish: aborts if users already exist.
 */
import { db, runMigrations } from "./client.js";
import { bootstrap } from "../bootstrap.js";
import {
  auditLog,
  games,
  gameStats,
  matchEvents,
  moderation,
  mvpVotes,
  seasons,
  settings,
  signups,
  users,
  venues,
} from "./schema.js";
import { eq } from "drizzle-orm";

const now = Math.floor(Date.now() / 1000);
const days = (n: number) => n * 86400;
const at = (daysFromNow: number, hour: number) => {
  const d = new Date((now + days(daysFromNow)) * 1000);
  d.setHours(hour, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
};

await runMigrations();
await bootstrap();

const existing = await db.query.users.findMany();
if (existing.length > 0) {
  console.log("Seed skipped: users already exist");
  process.exit(0);
}

await db
  .update(settings)
  .set({
    name: "Хамовники Футбол",
    currency: "Kč",
    qrRecipient: "Хамовники Футбол",
    qrAccount: "40817 0000 0000 4471",
    qrBank: "Т-Банк",
  })
  .where(eq(settings.id, 1));

const season = await db.query.seasons.findFirst({ where: eq(seasons.active, true) });
const seasonId = season!.id;

type SeedUser = [tgId: number, first: string, last: string, handle: string, pos: string, level: number, role?: "owner" | "organizer"];
const USERS: SeedUser[] = [
  [1000001, "Артём", "Соколов", "@artyom_s", "LCB", 3, "owner"],
  [1000002, "Мария", "Власова", "@maria_v", "CM", 3, "organizer"],
  [1000003, "Иван", "Петров", "@ivan_gk", "GK", 4],
  [1000004, "Дмитрий", "Волков", "@dvolkov", "ST", 5],
  [1000005, "Кирилл", "Мороз", "@kmoroz", "CM", 4],
  [1000006, "Сергей", "Лебедев", "@slebedev", "LB", 3],
  [1000007, "Никита", "Орлов", "@norlov", "RW", 4],
  [1000008, "Павел", "Зайцев", "@pzaytsev", "CDM", 3],
  [1000009, "Роман", "Гусев", "@rgusev", "RB", 3],
  [1000010, "Антон", "Беляев", "@abelyaev", "LW", 4],
  [1000011, "Глеб", "Сорокин", "@gsorokin", "ST", 3],
  [1000012, "Максим", "Дроздов", "@mdrozdov", "CM", 3],
  [1000013, "Егор", "Фомин", "@efomin", "CB", 3],
  [1000014, "Тимур", "Кузнецов", "@tkuznetsov", "RM", 3],
  [1000015, "Денис", "Логинов", "@dloginov", "LM", 4],
  [1000016, "Влад", "Громов", "@vgromov", "GK", 3],
  [1000017, "Олег", "Карпов", "@okarpov", "RB", 2],
];

const userIds: number[] = [];
for (const [tgId, first, last, handle, pos, level, role] of USERS) {
  const [u] = await db
    .insert(users)
    .values({
      tgId,
      first,
      last,
      handle,
      primaryPos: pos,
      fallbackPos: pos === "GK" ? [] : ["CM", "LB"].filter((p) => p !== pos).slice(0, 2),
      foot: "Правая",
      level,
      area: "Хамовники",
      kitSize: "M",
      role: role ?? "player",
      onboardedAt: now - days(90),
    })
    .returning();
  userIds.push(u!.id);
}
const uid = (i: number) => userIds[i]!; // 0-based index into USERS

const VENUES: [string, string, number, number, number][] = [
  ["Лужники, поле 3", "ул. Лужники, 24", 6000, 3, 14],
  ["Манеж ЦСКА", "Ленинградский пр-т, 39", 8000, 4, 20],
  ["Парк Горького", "Крымский Вал, 9", 4000, 2, 16],
  ["Сокольники", "Сокольнический Вал, 1", 3500, 2, 12],
];
const venueIds: number[] = [];
for (const [name, addr, rent, balls, bibs] of VENUES) {
  const [v] = await db.insert(venues).values({ name, addr, rent, balls, bibs }).returning();
  venueIds.push(v!.id);
}

/* ----------------------------------------------------------- upcoming games */
const mkGame = async (g: typeof games.$inferInsert) => (await db.insert(games).values(g).returning())[0]!;

const g1 = await mkGame({
  kind: "game", title: "Хамовники · 5×5", startsAt: at(2, 18), deadlineAt: at(2, 16),
  venueId: venueIds[0]!, aside: 5, mainSlots: 10, subSlots: 2, price: 350,
  payWhen: "signup", splitMode: "draft", seasonId, createdBy: uid(1),
});
const g2 = await mkGame({
  kind: "game", title: "Вторничные семёрки", startsAt: at(4, 20), deadlineAt: at(3, 21),
  venueId: venueIds[1]!, aside: 7, mainSlots: 14, subSlots: 4, price: 500,
  payWhen: "signup", splitMode: "auto", seasonId, createdBy: uid(1),
});
const g3 = await mkGame({
  kind: "game", title: "Четверг · восьмёрки", startsAt: at(6, 19), deadlineAt: at(6, 17),
  venueId: venueIds[2]!, aside: 8, mainSlots: 16, subSlots: 2, price: 300,
  payWhen: "approved", approval: true, splitMode: "auto", seasonId, createdBy: uid(1),
});
const g4 = await mkGame({
  kind: "game", title: "Большой футбол · 11×11", startsAt: at(8, 11), deadlineAt: at(7, 20),
  venueId: venueIds[0]!, aside: 11, mainSlots: 22, subSlots: 4, price: 450,
  payWhen: "after", splitMode: "manual", seasonId, createdBy: uid(1),
});
await mkGame({
  kind: "game", title: "Дворовые четвёрки", startsAt: at(3, 21), deadlineAt: at(3, 19),
  venueId: venueIds[3]!, aside: 4, mainSlots: 8, subSlots: 1, price: 250,
  payWhen: "signup", splitMode: "auto", seasonId, createdBy: uid(1),
});
await mkGame({
  kind: "meetup", title: "Воскресный митап", startsAt: at(9, 12),
  venueId: venueIds[3]!, capacity: 0, price: 0, payWhen: "after", seasonId, createdBy: uid(1),
  notes: "Свободная игра без жёсткого состава — приходи, разделимся на месте.",
});

// g1 roster: 8 confirmed with mixed pay states + waitlist + g3 pending.
const g1Roster: [idx: number, pos: string, pay: "paid" | "unpaid" | "partial"][] = [
  [0, "CB", "paid"], [2, "GK", "paid"], [3, "ST", "paid"], [4, "CM", "unpaid"],
  [5, "LB", "paid"], [6, "RW", "partial"], [7, "CDM", "paid"], [9, "LW", "unpaid"],
];
for (const [idx, pos, pay] of g1Roster) {
  await db.insert(signups).values({
    gameId: g1.id, userId: uid(idx), position: pos, status: "confirmed",
    payStatus: pay, payMethod: pay === "unpaid" ? null : idx === 2 ? "cash" : "qr",
  });
}
for (const idx of [10, 11]) {
  await db.insert(signups).values({ gameId: g1.id, userId: uid(idx), position: USERS[idx]![4], status: "waitlist" });
}
// g2 nearly full.
for (let i = 2; i < 15; i++) {
  await db.insert(signups).values({
    gameId: g2.id, userId: uid(i), position: USERS[i]![4], status: "confirmed",
    payStatus: i % 3 === 0 ? "unpaid" : "paid", payMethod: i % 3 === 0 ? null : "qr",
  });
}
// g3 pending approvals.
for (const idx of [13, 16]) {
  await db.insert(signups).values({ gameId: g3.id, userId: uid(idx), position: USERS[idx]![4], status: "pending" });
}
// g4 partially filled.
for (let i = 0; i < 14; i++) {
  await db.insert(signups).values({
    gameId: g4.id, userId: uid(i), position: USERS[i]![4], status: "confirmed", payStatus: "unpaid",
  });
}

/* ------------------------------------------------------------- past games */
type PastSpec = {
  title: string; daysAgo: number; venue: number; scoreA: number; scoreB: number;
  roster: number[]; events: [team: "a" | "b", scorer: number, assist: number | null][];
  mvpVotesFor: number;
};
const PAST: PastSpec[] = [
  {
    title: "Пятничный товарняк", daysAgo: 2, venue: 2, scoreA: 3, scoreB: 2,
    roster: [0, 2, 3, 4, 5, 6, 7, 9, 10, 11],
    events: [["a", 3, 0], ["a", 3, 6], ["a", 0, 7], ["b", 9, 10], ["b", 11, null]],
    mvpVotesFor: 3,
  },
  {
    title: "Среда, семёрки", daysAgo: 4, venue: 1, scoreA: 1, scoreB: 4,
    roster: [0, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14],
    events: [["a", 6, null], ["b", 10, 12], ["b", 10, null], ["b", 13, 10], ["b", 14, null]],
    mvpVotesFor: 10,
  },
  {
    title: "Хамовники · 5×5", daysAgo: 7, venue: 0, scoreA: 2, scoreB: 2,
    roster: [0, 2, 3, 5, 7, 9, 11, 12, 14, 15],
    events: [["a", 3, 0], ["a", 7, null], ["b", 9, 11], ["b", 12, null]],
    mvpVotesFor: 0,
  },
  {
    title: "Майский кубок", daysAgo: 10, venue: 3, scoreA: 5, scoreB: 1,
    roster: [0, 2, 3, 4, 6, 8, 10, 11, 13, 15],
    events: [["a", 0, 4], ["a", 0, null], ["a", 3, 0], ["a", 4, 6], ["a", 6, null], ["b", 11, null]],
    mvpVotesFor: 0,
  },
];

for (const spec of PAST) {
  const startsAt = at(-spec.daysAgo, 19);
  const g = await mkGame({
    kind: "game", title: spec.title, startsAt, deadlineAt: startsAt - 7200,
    venueId: venueIds[spec.venue]!, aside: 5, mainSlots: 10, subSlots: 2, price: 350,
    payWhen: "signup", splitMode: "auto", seasonId, createdBy: uid(1),
    startedAt: startsAt, finishedAt: startsAt + 3600,
    scoreA: spec.scoreA, scoreB: spec.scoreB, teamsPublishedAt: startsAt - 3600,
  });
  for (let i = 0; i < spec.roster.length; i++) {
    const idx = spec.roster[i]!;
    await db.insert(signups).values({
      gameId: g.id, userId: uid(idx), position: USERS[idx]![4],
      status: "confirmed", team: i % 2 === 0 ? "a" : "b",
      payStatus: "paid", payMethod: "qr", checkedIn: true,
    });
  }
  const tally = new Map<number, { goals: number; assists: number }>();
  for (const [team, scorerIdx, assistIdx] of spec.events) {
    await db.insert(matchEvents).values({
      gameId: g.id, minute: Math.floor(Math.random() * 50) + 1, team,
      scorerId: uid(scorerIdx), assistId: assistIdx == null ? null : uid(assistIdx),
    });
    const s = tally.get(scorerIdx) ?? { goals: 0, assists: 0 };
    s.goals++;
    tally.set(scorerIdx, s);
    if (assistIdx != null) {
      const a = tally.get(assistIdx) ?? { goals: 0, assists: 0 };
      a.assists++;
      tally.set(assistIdx, a);
    }
  }
  for (const [idx, st] of tally) {
    await db.insert(gameStats).values({ gameId: g.id, userId: uid(idx), ...st, source: "organizer", confirmed: true });
  }
  if (spec.mvpVotesFor) {
    for (const voterIdx of spec.roster.filter((r) => r !== spec.mvpVotesFor).slice(0, 4)) {
      await db.insert(mvpVotes).values({ gameId: g.id, voterId: uid(voterIdx), voteeId: uid(spec.mvpVotesFor) });
    }
  }
}

/* ----------------------------------------------------- moderation & audit */
await db.insert(moderation).values({
  userId: uid(16), kind: "warning", reason: "2 неявки за 60 дней", byId: uid(1), createdAt: now - days(3),
});
await db.insert(auditLog).values([
  { actorId: uid(1), action: "warn", target: "Олег Карпов", reason: "2 неявки за 60 дней", createdAt: now - days(3) },
  { actorId: uid(1), action: "edit", target: "Хамовники · 5×5", reason: "перенос на 18:30", createdAt: now - days(4) },
  { actorId: uid(1), action: "refund", target: "350", reason: "отмена до дедлайна", createdAt: now - days(5) },
]);

console.log(`Seed done: ${USERS.length} users, ${VENUES.length} venues, 6 upcoming + ${PAST.length} past games.`);
console.log("Dev logins (DEV_AUTH=1): owner tgId 1000001, organizer 1000002, players 1000003+.");
process.exit(0);
