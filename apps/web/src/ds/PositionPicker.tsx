/* Pitch-based position picker — ported from the design bundle. */
import type { CSSProperties, HTMLAttributes } from "react";
import { ROLE_COLOR, roleColorOf } from "./index";

export type Spot = { code: string; x: number; y: number };

/** Formation presets keyed by squad size; vertical pitch, GK at the bottom. */
export const FORMATIONS: Record<number, { label: string; shape: string; positions: Spot[] }> = {
  5: {
    label: "5-a-side",
    shape: "1-2-1",
    positions: [
      { code: "ST", x: 50, y: 26 },
      { code: "LM", x: 26, y: 50 },
      { code: "RM", x: 74, y: 50 },
      { code: "CB", x: 50, y: 71 },
      { code: "GK", x: 50, y: 89 },
    ],
  },
  6: {
    label: "6-a-side",
    shape: "2-1-2",
    positions: [
      { code: "LW", x: 30, y: 28 },
      { code: "RW", x: 70, y: 28 },
      { code: "CM", x: 50, y: 51 },
      { code: "LB", x: 28, y: 72 },
      { code: "RB", x: 72, y: 72 },
      { code: "GK", x: 50, y: 89 },
    ],
  },
  7: {
    label: "7-a-side",
    shape: "2-3-1",
    positions: [
      { code: "ST", x: 50, y: 26 },
      { code: "LM", x: 20, y: 49 },
      { code: "CM", x: 50, y: 52 },
      { code: "RM", x: 80, y: 49 },
      { code: "LB", x: 27, y: 73 },
      { code: "RB", x: 73, y: 73 },
      { code: "GK", x: 50, y: 90 },
    ],
  },
  9: {
    label: "9-a-side",
    shape: "3-3-2",
    positions: [
      { code: "LW", x: 36, y: 27 },
      { code: "RW", x: 64, y: 27 },
      { code: "LM", x: 22, y: 50 },
      { code: "CM", x: 50, y: 53 },
      { code: "RM", x: 78, y: 50 },
      { code: "LB", x: 22, y: 73 },
      { code: "CB", x: 50, y: 75 },
      { code: "RB", x: 78, y: 73 },
      { code: "GK", x: 50, y: 90 },
    ],
  },
  11: {
    label: "11-a-side",
    shape: "4-3-3",
    positions: [
      { code: "LW", x: 22, y: 25 },
      { code: "ST", x: 50, y: 22 },
      { code: "RW", x: 78, y: 25 },
      { code: "LCM", x: 28, y: 47 },
      { code: "CM", x: 50, y: 50 },
      { code: "RCM", x: 72, y: 47 },
      { code: "LB", x: 14, y: 71 },
      { code: "LCB", x: 38, y: 75 },
      { code: "RCB", x: 62, y: 75 },
      { code: "RB", x: 86, y: 71 },
      { code: "GK", x: 50, y: 90 },
    ],
  },
};

/** Snap any 4–11 a-side format to the nearest available pitch formation. */
export const pitchFormat = (aside: number | null | undefined): number => {
  const n = aside ?? 5;
  if (FORMATIONS[n]) return n;
  return n <= 5 ? 5 : n <= 7 ? 7 : n <= 9 ? 9 : 11;
};

export const formationFor = (format?: number): Spot[] => (FORMATIONS[pitchFormat(format)] ?? FORMATIONS[11]!).positions;

const PitchLines = () => (
  <svg className="lu-pitch__lines" viewBox="0 0 68 100" preserveAspectRatio="none" aria-hidden="true">
    <g fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4">
      <rect x="2" y="2" width="64" height="96" rx="1" />
      <line x1="2" y1="50" x2="66" y2="50" />
      <circle cx="34" cy="50" r="8.5" />
      <circle cx="34" cy="50" r="0.5" fill="rgba(255,255,255,0.6)" stroke="none" />
      <rect x="14" y="2" width="40" height="15" />
      <rect x="25" y="2" width="18" height="5" />
      <path d="M27 17 a8.5 8.5 0 0 0 14 0" />
      <rect x="14" y="83" width="40" height="15" />
      <rect x="25" y="93" width="18" height="5" />
      <path d="M27 83 a8.5 8.5 0 0 1 14 0" />
    </g>
  </svg>
);

type Single = { multiple?: false; value: string | null; onChange?: (v: string | null) => void };
type Multi = { multiple: true; value: string[]; onChange?: (v: string[]) => void };

export function PositionPicker({
  multiple,
  value,
  onChange,
  max = 3,
  exclude = [],
  format,
  positions,
  dotSize = 42,
  legend = false,
  className = "",
  style,
  ...rest
}: (Single | Multi) & {
  max?: number;
  exclude?: (string | null)[];
  format?: number;
  positions?: Spot[];
  dotSize?: number;
  legend?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "onChange">) {
  const spots = positions || formationFor(format);
  const selected: string[] = multiple ? (value ?? []) : value != null ? [value] : [];
  const isSel = (code: string) => selected.includes(code);
  const toggle = (code: string) => {
    if (multiple) {
      if (isSel(code)) onChange?.(selected.filter((c) => c !== code));
      else if (selected.length < max) onChange?.([...selected, code]);
    } else {
      (onChange as Single["onChange"])?.(isSel(code) ? null : code);
    }
  };
  return (
    <div style={style} className={className} {...rest}>
      <div className="lu-pitch" style={{ "--lu-dot": `${dotSize}px` } as CSSProperties}>
        <PitchLines />
        {spots.map((p) => {
          const disabled = exclude.includes(p.code);
          const sel = isSel(p.code);
          const rank = multiple ? selected.indexOf(p.code) + 1 : 0;
          return (
            <button
              key={p.code}
              type="button"
              className="lu-pitch__dot"
              data-selected={sel ? "true" : "false"}
              data-dim={disabled ? "true" : "false"}
              style={{ left: `${p.x}%`, top: `${p.y}%`, "--_c": roleColorOf(p.code) } as CSSProperties}
              disabled={disabled}
              onClick={() => toggle(p.code)}
              aria-pressed={sel}
            >
              {p.code}
              {multiple && rank > 0 && <span className="lu-pitch__rank">{rank}</span>}
            </button>
          );
        })}
      </div>
      {legend && <PosLegend />}
    </div>
  );
}

export function PosLegend() {
  const items: [string, string][] = [
    [ROLE_COLOR.gk, "Вратарь"],
    [ROLE_COLOR.def, "Защита"],
    [ROLE_COLOR.mid, "Центр"],
    [ROLE_COLOR.fwd, "Атака"],
  ];
  return (
    <div className="lu-legend-ru">
      {items.map(([c, l]) => (
        <span key={l}>
          <i style={{ background: c }} />
          {l}
        </span>
      ))}
    </div>
  );
}
