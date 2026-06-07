/** QR Platba — Czech SPD (Short Payment Descriptor) payload.
    Readable by Česká spořitelna (George), ČSOB, KB, Fio, Air, Raiffeisen, …

    Spec (ČBA / qr-platba.cz): values are ASCII-only — non-ASCII must be
    percent-encoded (Latin-1 base), which cannot represent Cyrillic at all,
    and banks like Fio reject diacritics outright. So we transliterate
    RN/MSG to plain uppercase Latin and keep the whole payload inside the
    QR alphanumeric set [0-9A-Z $%*+-./:] for maximum compatibility. */

const CURRENCY_MAP: Record<string, string> = {
  "Kč": "CZK",
  CZK: "CZK",
  "€": "EUR",
  EUR: "EUR",
  "zł": "PLN",
  PLN: "PLN",
  $: "USD",
  USD: "USD",
};

const RU_LAT: Record<string, string> = {
  а: "A", б: "B", в: "V", г: "G", д: "D", е: "E", ё: "E", ж: "ZH", з: "Z", и: "I",
  й: "I", к: "K", л: "L", м: "M", н: "N", о: "O", п: "P", р: "R", с: "S", т: "T",
  у: "U", ф: "F", х: "KH", ц: "TS", ч: "CH", ш: "SH", щ: "SCH", ъ: "", ы: "Y",
  ь: "", э: "E", ю: "YU", я: "YA",
};

/**
 * Transliterate to the SPD-safe charset: uppercase Latin + digits +
 * `space . - / + : $ %`-free punctuation subset. `*` is the field
 * delimiter and is never allowed inside a value.
 */
export function spdSafe(s: string, max: number): string {
  const out: string[] = [];
  for (const raw of s.normalize("NFD")) {
    if (/[̀-ͯ]/.test(raw)) continue; // strip diacritic marks (č→c, ř→r)
    const ch = raw === "·" || raw === "—" || raw === "–" ? " " : raw === "×" ? "X" : raw === "_" ? "-" : raw === "@" ? "" : raw;
    const lower = ch.toLowerCase();
    if (RU_LAT[lower] !== undefined) {
      out.push(RU_LAT[lower]!);
      continue;
    }
    const up = ch.toUpperCase();
    if (/[A-Z0-9 .,\-/:+]/.test(up)) out.push(up);
  }
  return out
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function buildSpd(opts: {
  iban: string;
  recipient?: string;
  amount?: number;
  currency?: string;
  message?: string;
  /** Variable symbol — we use the game id so payments are matchable. */
  vs?: number;
}): string {
  const parts = ["SPD*1.0", `ACC:${opts.iban.replace(/\s+/g, "").toUpperCase()}`];
  // AM: period separator, exactly 2 decimals, no leading-zero integer part.
  if (opts.amount && opts.amount >= 1) parts.push(`AM:${opts.amount.toFixed(2)}`);
  const cc = opts.currency ? CURRENCY_MAP[opts.currency] : undefined;
  if (cc) parts.push(`CC:${cc}`);
  if (opts.vs) parts.push(`X-VS:${String(Math.trunc(opts.vs)).slice(0, 10)}`);
  const rn = opts.recipient ? spdSafe(opts.recipient, 35) : "";
  if (rn) parts.push(`RN:${rn}`);
  const msg = opts.message ? spdSafe(opts.message, 60) : "";
  if (msg) parts.push(`MSG:${msg}`);
  return parts.join("*");
}

/** Real IBAN validation: structure + mod-97 checksum. */
export function looksLikeIban(s: string): boolean {
  const iban = s.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= "0" && ch <= "9" ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of value) remainder = (remainder * 10 + (d.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}

/**
 * MSG for a payment QR: payer name + tg handle + event + date, fitted
 * into SPD's 60-char ASCII budget (the title shrinks first, the name,
 * handle and date always survive).
 */
export function buildPayMsg(opts: { name: string; handle?: string; title: string; startsAt?: number }): string {
  const d = opts.startsAt ? new Date(opts.startsAt * 1000) : null;
  const date = d ? `${d.getDate()}.${d.getMonth() + 1}.` : "";
  const name = spdSafe(opts.name, 30);
  const handle = opts.handle ? spdSafe(opts.handle, 20) : "";
  const fixed = [name, handle, date].filter(Boolean);
  const fixedLen = fixed.join(" ").length;
  const titleBudget = Math.max(0, 60 - fixedLen - 1);
  const title = spdSafe(opts.title, titleBudget);
  return [name, handle, title, date].filter(Boolean).join(" ").slice(0, 60);
}
