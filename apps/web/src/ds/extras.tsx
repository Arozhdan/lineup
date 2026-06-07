/* Shared app-level pieces ported from the prototype's common.jsx. */
import type { CSSProperties, ReactNode } from "react";
import type { GameStatus } from "@lineup/shared";
import { I } from "@/icons";
import { Avatar, PositionBadge } from "./index";

/* ------------------------------------------------------------ RingProgress */
export function RingProgress({
  value = 0,
  size = 56,
  stroke = 5,
  color = "var(--accent)",
  children,
}: {
  value?: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="lu-ring" style={{ "--sz": `${size}px` } as CSSProperties}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill-tertiary)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .6s var(--ease-out)" }}
        />
      </svg>
      <span className="lu-ring__txt">{children}</span>
    </div>
  );
}

/* -------------------------------------------------------------- FormPills */
export function FormPills({ form }: { form: string[] }) {
  return (
    <div className="lu-form-pills">
      {form.map((r, i) => (
        <span key={i} className="lu-form-pill" data-r={r}>
          {r}
        </span>
      ))}
    </div>
  );
}

export const relColor = (v: number): string => (v >= 90 ? "var(--success)" : v >= 75 ? "var(--warning)" : "var(--danger)");

/* ---------------------------------------------------------------- Stepper */
export function Stepper({ value, onDec, onInc }: { value: number; onDec: () => void; onInc: () => void }) {
  return (
    <div className="lu-stepper">
      <button type="button" onClick={onDec}>
        <I.Minus width={16} height={16} />
      </button>
      <span className="lu-stepper__v">{value}</span>
      <button type="button" onClick={onInc}>
        <I.Plus width={16} height={16} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------- Lede */
export function Lede({ title, text }: { title: ReactNode; text?: ReactNode }) {
  return (
    <div style={{ padding: "0 2px" }}>
      <h2 className="lu-h1">{title}</h2>
      {text && <p className="lu-lede">{text}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- KeyFact */
export function KeyFact({ icon, k, v }: { icon?: ReactNode; k: ReactNode; v: ReactNode }) {
  return (
    <div className="lu-keyfact">
      <span className="lu-keyfact__k">
        {icon}
        {k}
      </span>
      <span className="lu-keyfact__v">{v}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ QrBox */
/** The community payment QR. Shows the configured image, or a placeholder pattern. */
export function QrBox({ src }: { src?: string | null }) {
  if (src) {
    return (
      <div className="lu-qr">
        <img src={src} alt="QR для оплаты" />
      </div>
    );
  }
  const cells: ReactNode[] = [];
  const seed = [1,0,1,1,0,1,0,0,1,0,1,1,1,0,0,1,0,1,0,1,1,1,0,0,1,1,0,1,0,0,1,0,1,1,0,1,0,0,1,1,1,0,1,0,1,1,0,0,1];
  for (let y = 0; y < 11; y++)
    for (let x = 0; x < 11; x++) {
      const corner = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
      const on = corner || seed[(x * 7 + y * 3) % seed.length];
      if (on) cells.push(<rect key={`${x}-${y}`} x={x * 9} y={y * 9} width="8" height="8" rx="1.5" fill="#0d1b12" />);
    }
  return (
    <div className="lu-qr">
      <svg viewBox="0 0 99 99">{cells}</svg>
    </div>
  );
}

/* ------------------------------------------------------------- PlayerCell */
export function PlayerCell({
  name,
  you = false,
  pos,
  sub,
  trailing,
  onClick,
}: {
  name: string;
  you?: boolean;
  pos?: string | null;
  sub?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="lu-pool-card" onClick={onClick} style={!onClick ? { cursor: "default" } : undefined}>
      <Avatar name={name} size={36} />
      <span className="lu-grow">
        <span style={{ display: "block", fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{you ? `${name} (вы)` : name}</span>
        {sub && <span style={{ display: "block", fontSize: 12, color: "var(--text-hint)" }}>{sub}</span>}
      </span>
      {pos && <PositionBadge code={pos} />}
      {trailing}
    </button>
  );
}

/* ------------------------------------------------------------ MatchCardRU */
const MC_STATUS: Record<string, { label: string; bg: string; fg: string; bar: string }> = {
  open: { label: "Открыта", bg: "var(--success-soft)", fg: "var(--green-700)", bar: "var(--success)" },
  filling: { label: "Заполняется", bg: "var(--warning-soft)", fg: "#9A6400", bar: "var(--warning)" },
  full: { label: "Полная", bg: "var(--fill-tertiary)", fg: "var(--text-secondary)", bar: "var(--gray-400)" },
  live: { label: "В игре", bg: "var(--danger-soft)", fg: "#C42B22", bar: "var(--danger)" },
  done: { label: "Завершена", bg: "var(--fill-tertiary)", fg: "var(--text-secondary)", bar: "var(--gray-400)" },
  cancelled: { label: "Отменена", bg: "var(--danger-soft)", fg: "#C42B22", bar: "var(--gray-400)" },
};

/** My relationship to the game, rendered as an explicit chip in the footer. */
const MY_CHIP: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "Вы в составе", cls: "lu-match__you" },
  pending: { label: "Заявка на рассмотрении", cls: "lu-match__you lu-match__you--pending" },
  waitlist: { label: "В листе ожидания", cls: "lu-match__you lu-match__you--waitlist" },
};

export function MatchCardRU({
  title,
  caps,
  venue,
  format,
  filled = 0,
  total = 10,
  price,
  priceLabel,
  status = "open",
  score,
  youIn = false,
  myStatus,
  onClick,
}: {
  title: ReactNode;
  caps?: ReactNode;
  venue?: string;
  format?: string;
  filled?: number;
  total?: number;
  price?: number;
  priceLabel?: string;
  status?: GameStatus | string;
  score?: ReactNode;
  youIn?: boolean;
  /** "confirmed" | "pending" | "waitlist" — overrides youIn with an explicit chip. */
  myStatus?: string | null;
  onClick?: () => void;
}) {
  const st = MC_STATUS[status] ?? MC_STATUS.open!;
  const pct = total ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  const left = Math.max(0, total - filled);
  const my = myStatus ?? (youIn ? "confirmed" : "");
  // My relationship to the game replaces the generic status pill in the top
  // row — the footer keeps the full-width progress bar (no layout squeeze).
  const myChip = status !== "done" && status !== "cancelled" && status !== "live" ? MY_CHIP[my] : undefined;
  const Tag = (onClick ? "button" : "div") as "button";
  return (
    <Tag className={`lu-match${onClick ? " lu-match--tappable" : ""}`} onClick={onClick} type={onClick ? "button" : undefined}>
      <div className="lu-match__top">
        <span className="lu-match__when">{caps}</span>
        {myChip ? (
          <span className={myChip.cls}>
            {my === "pending" ? <I.Clock width={12} height={12} /> : my === "waitlist" ? <I.Users width={12} height={12} /> : <I.Check width={12} height={12} />}{" "}
            {myChip.label}
          </span>
        ) : (
          <span className="lu-match__status" style={{ background: st.bg, color: st.fg }}>
            {status === "live" && <span className="lu-match__live-dot" />}
            {st.label}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span className="lu-match__title">{title}</span>
        {score && <span className="lu-match__score">{score}</span>}
      </div>
      {(venue || format) && (
        <div className="lu-match__meta">
          {venue && (
            <span>
              <I.Pin width={13} height={13} />
              {venue}
            </span>
          )}
          {format && (
            <span>
              <I.Field width={13} height={13} />
              {format}
            </span>
          )}
          {price ? (
            <span>
              <I.Coins width={13} height={13} />
              {priceLabel ?? price}
            </span>
          ) : null}
        </div>
      )}
      {status !== "done" && status !== "cancelled" && total > 0 && (
        <div className="lu-match__foot">
          <div className="lu-match__bar">
            <div className="lu-match__fill" style={{ width: `${pct}%`, background: st.bar }} />
          </div>
          <span className="lu-match__count">
            <b>{filled}</b>/{total} · {left === 0 ? "мест нет" : `ещё ${left}`}
          </span>
        </div>
      )}
    </Tag>
  );
}
