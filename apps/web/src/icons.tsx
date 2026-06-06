/* Lineup — shared icon set (Lucide-style 24px stroke), ported from the prototype. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
type Shape = string | { tag: "circle"; cx: number; cy: number; r: number } | { tag: "rect"; x: number; y: number; w: number; h: number; rx?: number } | { tag: "line"; x1: number; y1: number; x2: number; y2: number };

const S = (props: P, shapes: Shape[], strokeWidth = 2) => (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {shapes.map((d, i) =>
      typeof d === "string" ? (
        <path key={i} d={d} />
      ) : d.tag === "circle" ? (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} />
      ) : d.tag === "rect" ? (
        <rect key={i} x={d.x} y={d.y} width={d.w} height={d.h} rx={d.rx} />
      ) : (
        <line key={i} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} />
      ),
    )}
  </svg>
);
const circle = (cx: number, cy: number, r: number): Shape => ({ tag: "circle", cx, cy, r });
const rect = (x: number, y: number, w: number, h: number, rx?: number): Shape => ({ tag: "rect", x, y, w, h, rx });
const line = (x1: number, y1: number, x2: number, y2: number): Shape => ({ tag: "line", x1, y1, x2, y2 });

export const I = {
  Calendar: (p: P) => S(p, [rect(3, 4.5, 18, 17, 3), "M3 9h18", "M8 2v4", "M16 2v4"]),
  Trophy: (p: P) => S(p, ["M7 4h10v5a5 5 0 0 1-10 0z", "M7 6H4v1a3 3 0 0 0 3 3", "M17 6h3v1a3 3 0 0 1-3 3", "M9 19h6", "M12 14v5"]),
  User: (p: P) => S(p, [circle(12, 8, 4), "M4 21a8 8 0 0 1 16 0"]),
  History: (p: P) => S(p, ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 4v4h4", "M12 8v4l3 2"]),
  Plus: (p: P) => S(p, ["M12 5v14", "M5 12h14"], 2.4),
  Minus: (p: P) => S(p, ["M5 12h14"], 2.4),
  Pin: (p: P) => S(p, ["M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z", circle(12, 10, 2.6)]),
  Field: (p: P) => S(p, [rect(3, 5, 18, 14, 2), "M12 5v14", "M3 9v6", "M21 9v6"]),
  Clock: (p: P) => S(p, [circle(12, 12, 9), "M12 7v5l3 2"]),
  Bell: (p: P) => S(p, ["M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6", "M10.5 20a2 2 0 0 0 3 0"]),
  Share: (p: P) => S(p, [circle(18, 5, 3), circle(6, 12, 3), circle(18, 19, 3), "M8.6 13.5l6.8 4", "M15.4 6.5l-6.8 4"]),
  Check: (p: P) => S(p, ["M20 6L9 17l-5-5"], 2.6),
  CheckCircle: (p: P) => S(p, ["M21 12a9 9 0 1 1-3.2-6.9", "M9 12l2 2 5-5"]),
  X: (p: P) => S(p, ["M6 6l12 12", "M18 6L6 18"], 2.4),
  ChevronRight: (p: P) => S(p, ["M9 6l6 6-6 6"], 2.2),
  ChevronLeft: (p: P) => S(p, ["M15 6l-6 6 6 6"], 2.2),
  ChevronDown: (p: P) => S(p, ["M6 9l6 6 6-6"], 2.2),
  Shield: (p: P) => S(p, ["M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"]),
  Whistle: (p: P) => S(p, [circle(8, 14, 5), "M13 13l8-3-1-3-8 2", "M8 9V6h3"]),
  Settings: (p: P) =>
    S(p, [
      circle(12, 12, 3),
      "M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1 2 2 0 0 1-4 0 1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15a2 2 0 0 1 0-4 1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.6a2 2 0 0 1 4 0 1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 19.4 11a2 2 0 0 1 0 4z",
    ]),
  Users: (p: P) => S(p, [circle(9, 8, 3.4), "M2.5 20a6.5 6.5 0 0 1 13 0", "M16 5.2a3.4 3.4 0 0 1 0 6.6", "M18 14.4a6.5 6.5 0 0 1 3.5 5.6"]),
  Star: (p: P) => S(p, ["M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"]),
  Camera: (p: P) => S(p, ["M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", circle(12, 13, 3.5)]),
  CreditCard: (p: P) => S(p, [rect(2, 5, 20, 14, 3), "M2 10h20"]),
  Wallet: (p: P) => S(p, ["M3 7a2 2 0 0 1 2-2h13v4", rect(3, 7, 18, 13, 2), "M16 13h3"]),
  QrCode: (p: P) => S(p, [rect(3, 3, 7, 7, 1), rect(14, 3, 7, 7, 1), rect(3, 14, 7, 7, 1), "M14 14h3v3", "M20 14v0", "M14 20h0", "M17 20h3v0", "M20 17v0"]),
  Globe: (p: P) => S(p, [circle(12, 12, 9), "M3 12h18", "M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"]),
  LogOut: (p: P) => S(p, ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"]),
  Edit: (p: P) => S(p, ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"]),
  Trash: (p: P) => S(p, ["M3 6h18", "M8 6V4h8v2", "M6 6l1 14h10l1-14", "M10 11v5", "M14 11v5"]),
  Filter: (p: P) => S(p, ["M3 5h18l-7 8v6l-4-2v-4z"]),
  Coins: (p: P) => S(p, [circle(8, 8, 5), "M18.1 6.4a5 5 0 0 1 0 11.2", "M11.5 12.9a5 5 0 0 0 0 4.7"]),
  Megaphone: (p: P) => S(p, ["M3 11v2a1 1 0 0 0 1 1h2l8 5V5L6 10H4a1 1 0 0 0-1 1z", "M18 8a4 4 0 0 1 0 8"]),
  BarChart: (p: P) => S(p, [line(6, 20, 6, 11), line(12, 20, 12, 4), line(18, 20, 18, 14), line(3, 20, 21, 20)]),
  Ban: (p: P) => S(p, [circle(12, 12, 9), line(5.6, 5.6, 18.4, 18.4)]),
  Repeat: (p: P) => S(p, ["M17 2l4 4-4 4", "M3 11V9a4 4 0 0 1 4-4h14", "M7 22l-4-4 4-4", "M21 13v2a4 4 0 0 1-4 4H3"]),
  Map: (p: P) => S(p, ["M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z", "M9 4v14", "M15 6v14"]),
  Flag: (p: P) => S(p, ["M4 21V4", "M4 4h13l-2 4 2 4H4"]),
  Target: (p: P) => S(p, [circle(12, 12, 9), circle(12, 12, 5), circle(12, 12, 1)]),
  Send: (p: P) => S(p, ["M22 2L11 13", "M22 2l-7 20-4-9-9-4z"]),
  Copy: (p: P) => S(p, [rect(9, 9, 12, 12, 2), "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"]),
  UserPlus: (p: P) => S(p, [circle(9, 8, 3.6), "M3 20a6 6 0 0 1 12 0", "M18 8v6", "M15 11h6"]),
  UserX: (p: P) => S(p, [circle(9, 8, 3.6), "M3 20a6 6 0 0 1 12 0", "M16 9l5 5", "M21 9l-5 5"]),
  Crown: (p: P) => S(p, ["M3 7l4 4 5-7 5 7 4-4-1.5 12H4.5z"]),
  Shuffle: (p: P) => S(p, ["M16 4h5v5", "M21 4l-7 7", "M3 4l7 7", "M16 20h5v-5", "M21 20L4 4", "M10 14l-7 7"]),
  GripVertical: (p: P) => S(p, [circle(9, 6, 1), circle(15, 6, 1), circle(9, 12, 1), circle(15, 12, 1), circle(9, 18, 1), circle(15, 18, 1)]),
  Download: (p: P) => S(p, ["M12 3v12", "M7 11l5 5 5-5", "M5 21h14"]),
  Wifi: (p: P) => S(p, ["M5 12a10 10 0 0 1 14 0", "M8.5 15.5a5 5 0 0 1 7 0", circle(12, 19, 0.5)]),
  AlertTriangle: (p: P) => S(p, ["M10.3 4l-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0z", "M12 9v4", "M12 17h0"]),
  Inbox: (p: P) => S(p, ["M3 12h5l2 3h4l2-3h5", "M5 5h14l2 7v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"]),
  Lock: (p: P) => S(p, [rect(4, 11, 16, 10, 2), "M8 11V8a4 4 0 0 1 8 0v3"]),
  Note: (p: P) => S(p, ["M5 3h11l4 4v14a0 0 0 0 1 0 0H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z", "M15 3v5h5", "M8 13h8", "M8 17h5"]),
  Refresh: (p: P) => S(p, ["M21 12a9 9 0 1 1-2.6-6.4", "M21 4v5h-5"]),
  Phone: (p: P) => S(p, ["M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"]),
  Info: (p: P) => S(p, [circle(12, 12, 9), "M12 11v5", "M12 8h0"]),
};

export type IconName = keyof typeof I;
