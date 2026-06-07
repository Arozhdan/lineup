/** QR Platba — Czech SPD (Short Payment Descriptor) payload.
    Readable by Česká spořitelna, ČSOB, KB, Fio, Air, Raiffeisen, … */

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

/** SPD forbids '*' in values; message is best kept short and simple. */
const sanitize = (s: string) => s.replace(/\*/g, " ").trim().slice(0, 60);

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
  if (opts.amount && opts.amount > 0) parts.push(`AM:${opts.amount.toFixed(2)}`);
  const cc = opts.currency ? CURRENCY_MAP[opts.currency] : undefined;
  if (cc) parts.push(`CC:${cc}`);
  if (opts.recipient) parts.push(`RN:${sanitize(opts.recipient)}`);
  if (opts.message) parts.push(`MSG:${sanitize(opts.message)}`);
  if (opts.vs) parts.push(`X-VS:${String(opts.vs).slice(0, 10)}`);
  return parts.join("*");
}

/** Loose IBAN sanity check (CZ IBANs are 24 chars, but accept any country). */
export const looksLikeIban = (s: string): boolean => /^[A-Z]{2}\d{2}[A-Z0-9\s]{10,30}$/i.test(s.trim());
