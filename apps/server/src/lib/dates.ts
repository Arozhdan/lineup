const fmt = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

/** "вс, 8 июн., 18:00" → normalized to "вс 8 июн, 18:00". */
export function fmtDateTime(unixSec: number): string {
  return fmt.format(new Date(unixSec * 1000)).replaceAll(".", "").replace(" г,", ",");
}
