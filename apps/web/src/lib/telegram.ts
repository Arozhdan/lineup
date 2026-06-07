/* Thin typed wrapper over the official Telegram Mini App bridge
   (telegram-web-app.js, loaded in index.html). Safe no-ops in a plain browser. */

type TgBackButton = {
  isVisible: boolean;
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
};

type TgHaptic = {
  impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
  notificationOccurred(type: "error" | "success" | "warning"): void;
};

export type TelegramWebApp = {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string } };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  isExpanded: boolean;
  version: string;
  BackButton: TgBackButton;
  HapticFeedback: TgHaptic;
  ready(): void;
  expand(): void;
  close(): void;
  onEvent(event: string, cb: () => void): void;
  offEvent(event: string, cb: () => void): void;
  openTelegramLink(url: string): void;
  /** Bot API 8.0+: native "save file" prompt inside Telegram. */
  downloadFile?(params: { url: string; file_name: string }, callback?: (accepted: boolean) => void): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  disableVerticalSwipes?(): void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const tg: TelegramWebApp | null = window.Telegram?.WebApp ?? null;

/** True when actually running inside Telegram (initData present). */
export const inTelegram = !!tg && tg.initData.length > 0;

export function initTelegram(): void {
  if (!tg) return;
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
}

export function haptic(type: "success" | "error" | "tap" = "tap"): void {
  if (!tg) return;
  if (type === "tap") tg.HapticFeedback.impactOccurred("light");
  else tg.HapticFeedback.notificationOccurred(type);
}

export function applyTelegramTheme(): "light" | "dark" {
  const stored = localStorage.getItem("lu_theme");
  const scheme = stored === "dark" || stored === "light" ? stored : (tg?.colorScheme ?? "light");
  document.documentElement.setAttribute("data-theme", scheme);
  if (tg) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    if (bg.startsWith("#")) {
      tg.setHeaderColor?.(bg);
      tg.setBackgroundColor?.(bg);
    }
  }
  return scheme;
}

export function setTheme(scheme: "light" | "dark"): void {
  localStorage.setItem("lu_theme", scheme);
  applyTelegramTheme();
}

/** Save a file to the device: native Telegram prompt when available,
    plain browser download otherwise. `url` may be relative. */
export function saveFile(url: string, fileName: string): void {
  const abs = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  if (tg?.downloadFile) {
    tg.downloadFile({ url: abs, file_name: fileName });
    return;
  }
  const a = document.createElement("a");
  a.href = abs;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const TAPPABLE =
  ".lu-btn, .lu-tab, .lu-chip, .lu-pool-card, .lu-cell--tappable, .lu-seg__opt, " +
  ".lu-pitch__dot, .lu-switch, .lu-radio, .lu-match--tappable, .lu-action, .lu-vote, " +
  ".lu-iconbtn, .lu-tally-btn, .lu-mode-card, .lu-navbar__btn, .lu-stepper button";

/** One delegated listener: light impact on every tappable control. */
export function initHaptics(): void {
  if (!tg) return;
  document.addEventListener(
    "click",
    (e) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest(TAPPABLE)) haptic("tap");
    },
    { capture: true, passive: true },
  );
}
