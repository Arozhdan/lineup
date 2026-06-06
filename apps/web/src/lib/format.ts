/* RU formatting helpers shared by all screens. */

let currency = "Kč";
export const setCurrency = (c: string) => {
  if (c) currency = c;
};
export const cur = () => currency;

export const fmtMoney = (n: number): string =>
  n ? `${n.toLocaleString("ru-RU").replace(/ /g, " ")} ${currency}` : "—";

const capsFmt = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const longFmt = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const clean = (s: string) => s.replaceAll(".", "").replace(/\s?г$/, "");

/** "ВС 8 ИЮН · 18:00" — match card caption. */
export const fmtCaps = (unixSec: number): string =>
  `${clean(capsFmt.format(new Date(unixSec * 1000))).toUpperCase()} · ${timeFmt.format(new Date(unixSec * 1000))}`;

/** "вс 8 июн, 18:00" */
export const fmtWhen = (unixSec: number): string => {
  const s = clean(longFmt.format(new Date(unixSec * 1000)));
  return s.replace(/, (\d{2}:\d{2})$/, ", $1");
};

/** "вс 8 июн" */
export const fmtDay = (unixSec: number): string => clean(capsFmt.format(new Date(unixSec * 1000)));

/** "18:00" */
export const fmtTime = (unixSec: number): string => timeFmt.format(new Date(unixSec * 1000));

/** "до вс 16:00" — deadline hint. */
export const fmtDeadline = (unixSec: number | null): string => {
  if (!unixSec) return "—";
  const d = new Date(unixSec * 1000);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? `сегодня до ${timeFmt.format(d)}` : `${fmtDay(unixSec)} до ${timeFmt.format(d)}`;
};

/** "3:45" mm:ss for timers and match clocks. */
export const fmtClock = (totalSec: number): string =>
  `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;

export const plural = (n: number, one: string, few: string, many: string): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};
