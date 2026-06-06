/* Lineup Design System — React components, ported 1:1 from the design bundle. */
import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { POSITION_ROLE, type RoleGroup } from "@lineup/shared";

export const ROLE_COLOR: Record<RoleGroup, string> = {
  gk: "var(--pos-gk)",
  def: "var(--pos-def)",
  mid: "var(--pos-mid)",
  fwd: "var(--pos-fwd)",
};

export const roleColorOf = (code: string | null | undefined): string =>
  ROLE_COLOR[(code && POSITION_ROLE[code]) || "mid"];

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/* ---------------------------------------------------------------- Avatar */
const AVATAR_SIZES = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 } as const;
const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

export function Avatar({
  name = "",
  src,
  size = "md",
  positionBadge,
  positionColor,
  online = false,
  className = "",
  style,
  ...rest
}: {
  name?: string;
  src?: string;
  size?: keyof typeof AVATAR_SIZES | number;
  positionBadge?: string | null;
  positionColor?: string;
  online?: boolean;
} & HTMLAttributes<HTMLSpanElement>) {
  const px = typeof size === "number" ? size : AVATAR_SIZES[size];
  return (
    <span className={cx("lu-avatar", className)} style={{ "--_sz": `${px}px`, ...style } as CSSProperties} {...rest}>
      {src ? <img className="lu-avatar__img" src={src} alt={name} /> : initials(name)}
      {positionBadge && (
        <span className="lu-avatar__badge" style={{ background: positionColor || roleColorOf(positionBadge) }}>
          {positionBadge}
        </span>
      )}
      {online && !positionBadge && <span className="lu-avatar__status" />}
    </span>
  );
}

/* ----------------------------------------------------------------- Badge */
export function Badge({
  variant = "neutral",
  solid = false,
  dot = false,
  size = "md",
  children,
  className = "",
  ...rest
}: {
  variant?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
  solid?: boolean;
  dot?: boolean;
  size?: "sm" | "md";
  children?: ReactNode;
} & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cx("lu-badge", variant !== "neutral" && `lu-badge--${variant}`, solid && "lu-badge--solid", size === "sm" && "lu-badge--sm", className)}
      {...rest}
    >
      {dot && <span className="lu-badge__dot" />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Card */
export function Card({
  pad = false,
  flat = false,
  onClick,
  children,
  className = "",
  ...rest
}: {
  pad?: boolean;
  flat?: boolean;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("lu-card", pad && "lu-card--pad", flat && "lu-card--flat", onClick && "lu-card--tappable", className)}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Stat */
export function Stat({
  value,
  label,
  sub,
  size = "md",
  color,
  align = "start",
  className = "",
  style,
  ...rest
}: {
  value: ReactNode;
  label?: ReactNode;
  sub?: ReactNode;
  size?: "sm" | "md" | "lg";
  color?: string;
  align?: "start" | "center" | "end";
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("lu-stat", size !== "md" && `lu-stat--${size}`, className)}
      style={{ "--_color": color, "--_align": align === "center" ? "center" : align === "end" ? "flex-end" : "flex-start", ...style } as CSSProperties}
      {...rest}
    >
      <span className="lu-stat__val">{value}</span>
      <span className="lu-stat__label">{label}</span>
      {sub && <span className="lu-stat__sub">{sub}</span>}
    </div>
  );
}

/* ------------------------------------------------------------ EmptyState */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
  ...rest
}: {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("lu-empty", className)} {...rest}>
      {icon && <div className="lu-empty__icon">{icon}</div>}
      {title && <div className="lu-empty__title">{title}</div>}
      {description && <div className="lu-empty__desc">{description}</div>}
      {action && <div className="lu-empty__action">{action}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- Sheet */
export function Sheet({
  open = false,
  onClose,
  title,
  showClose = true,
  showGrip = true,
  children,
  className = "",
  ...rest
}: {
  open?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  showClose?: boolean;
  showGrip?: boolean;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
    else {
      const t = setTimeout(() => setMounted(false), 400);
      return () => clearTimeout(t);
    }
  }, [open]);
  if (!mounted && !open) return null;
  return (
    <div className="lu-sheet-root" data-open={open ? "true" : "false"}>
      <div className="lu-sheet-scrim" onClick={onClose} />
      <div className={cx("lu-sheet", className)} role="dialog" aria-modal="true" {...rest}>
        {showGrip && <div className="lu-sheet__grip" />}
        {(title || showClose) && (
          <div className="lu-sheet__head">
            <span className="lu-sheet__title">{title}</span>
            {showClose && (
              <button className="lu-sheet__close" onClick={onClose} aria-label="Close">
                ✕
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- PositionBadge */
export function PositionBadge({
  code,
  size = "md",
  variant = "solid",
  color,
  className = "",
  style,
  ...rest
}: {
  code: string;
  size?: "md" | "lg";
  variant?: "solid" | "soft" | "outline";
  color?: string;
} & HTMLAttributes<HTMLSpanElement>) {
  const c = color || roleColorOf(code);
  const styleVars: CSSProperties =
    variant === "solid" ? { background: c, color: "#fff" } : variant === "soft" ? { color: c, background: "transparent" } : { color: c };
  return (
    <span
      className={cx("lu-posbadge", size === "lg" && "lu-posbadge--lg", variant !== "solid" && `lu-posbadge--${variant}`, className)}
      style={{ ...styleVars, ...style }}
      {...rest}
    >
      {code}
    </span>
  );
}

/* ---------------------------------------------------------------- Button */
export function Button({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  disabled = false,
  leadingIcon = null,
  trailingIcon = null,
  type = "button",
  children,
  className = "",
  ...rest
}: {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cx("lu-btn", `lu-btn--${variant}`, size !== "md" && `lu-btn--${size}`, block && "lu-btn--block", className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="lu-btn__spinner" aria-hidden="true" /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}

/* ----------------------------------------------------------------- Input */
export function Input({
  label,
  help,
  invalid = false,
  leadingIcon = null,
  prefix = null,
  suffix = null,
  id,
  className = "",
  ...rest
}: {
  label?: string;
  help?: ReactNode;
  invalid?: boolean;
  leadingIcon?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "prefix">) {
  const fid = id || (label ? `lu-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  return (
    <div className={cx("lu-field", invalid && "lu-field--invalid", className)}>
      {label && (
        <label className="lu-field__label" htmlFor={fid}>
          {label}
        </label>
      )}
      <div className="lu-field__wrap">
        {leadingIcon && <span className="lu-field__icon">{leadingIcon}</span>}
        {prefix && <span className="lu-field__affix">{prefix}</span>}
        <input id={fid} className="lu-field__input" {...rest} />
        {suffix && <span className="lu-field__affix">{suffix}</span>}
      </div>
      {help && <span className="lu-field__help">{help}</span>}
    </div>
  );
}

/* ------------------------------------------------------ SegmentedControl */
export type SegOption<T extends string> = T | { value: T; label: string };

export function SegmentedControl<T extends string>({
  options = [],
  value,
  onChange,
  className = "",
  ...rest
}: {
  options: SegOption<T>[];
  value: T;
  onChange?: (v: T) => void;
} & Omit<HTMLAttributes<HTMLDivElement>, "onChange">) {
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const idx = Math.max(
    0,
    items.findIndex((o) => o.value === value),
  );
  const pct = items.length ? 100 / items.length : 100;
  return (
    <div className={cx("lu-seg", className)} role="tablist" {...rest}>
      <span
        className="lu-seg__thumb"
        style={{ width: `calc(${pct}% - 2px)`, transform: `translateX(calc(${idx} * (100% + 2px) + ${idx === 0 ? 2 : 0}px))` }}
        aria-hidden="true"
      />
      {items.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className="lu-seg__opt" onClick={() => onChange?.(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Switch */
export function Switch({
  checked = false,
  onChange,
  disabled = false,
  className = "",
  ...rest
}: {
  checked?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cx("lu-switch", className)}
      onClick={() => onChange?.(!checked)}
      {...rest}
    >
      <span className="lu-switch__knob" aria-hidden="true" />
    </button>
  );
}

/* -------------------------------------------------------------- ListItem */
const Chevron = () => (
  <svg className="lu-cell__chev" width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
    <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function ListItem({
  title,
  subtitle,
  icon = null,
  iconColor,
  leading = null,
  trailing = null,
  value,
  chevron = false,
  destructive = false,
  onClick,
  className = "",
  ...rest
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  iconColor?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  value?: ReactNode;
  chevron?: boolean;
  destructive?: boolean;
  onClick?: () => void;
} & Omit<HTMLAttributes<HTMLElement>, "title" | "onClick">) {
  const tappable = !!onClick || chevron;
  const Tag = (onClick ? "button" : "div") as "button";
  return (
    <Tag
      className={cx("lu-cell", tappable && "lu-cell--tappable", destructive && "lu-cell--destructive", className)}
      onClick={onClick}
      {...(rest as object)}
    >
      {(leading || icon) && (
        <span className="lu-cell__lead">
          {leading || (
            <span className="lu-cell__icon" style={{ background: iconColor || "var(--accent)" }}>
              {icon}
            </span>
          )}
        </span>
      )}
      <span className="lu-cell__body">
        <span className="lu-cell__title">{title}</span>
        {subtitle && <span className="lu-cell__sub">{subtitle}</span>}
      </span>
      {(trailing || value || chevron) && (
        <span className="lu-cell__trail">
          {value != null && <span>{value}</span>}
          {trailing}
          {chevron && <Chevron />}
        </span>
      )}
    </Tag>
  );
}

/* ----------------------------------------------------------- ListSection */
export function ListSection({
  label,
  footer,
  children,
  className = "",
  ...rest
}: {
  label?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("lu-list", className)} {...rest}>
      {label && <div className="lu-list__label">{label}</div>}
      <div className="lu-list__sec">{children}</div>
      {footer && <div className="lu-list__footer">{footer}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- NavBar */
const BackChevron = () => (
  <svg width="11" height="18" viewBox="0 0 11 18" fill="none" aria-hidden="true">
    <path d="M9.5 1L2 9l7.5 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function NavBar({
  title,
  subtitle,
  onBack,
  backLabel = "Назад",
  leading = null,
  trailing = null,
  plain = false,
  className = "",
  ...rest
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  plain?: boolean;
} & Omit<HTMLAttributes<HTMLElement>, "title">) {
  return (
    <header className={cx("lu-navbar", plain && "lu-navbar--plain", className)} {...rest}>
      <div className="lu-navbar__side">
        {onBack ? (
          <button className="lu-navbar__btn" onClick={onBack}>
            <BackChevron />
            {backLabel}
          </button>
        ) : (
          leading
        )}
      </div>
      <div>
        <div className="lu-navbar__title">{title}</div>
        {subtitle && <div className="lu-navbar__sub">{subtitle}</div>}
      </div>
      <div className="lu-navbar__side lu-navbar__side--right">{trailing}</div>
    </header>
  );
}

/* ---------------------------------------------------------------- TabBar */
export function TabBar<T extends string>({
  items = [],
  value,
  onChange,
  className = "",
  ...rest
}: {
  items: { value: T; label: string; icon: ReactNode; badge?: number }[];
  value: T;
  onChange?: (v: T) => void;
} & Omit<HTMLAttributes<HTMLElement>, "onChange">) {
  return (
    <nav className={cx("lu-tabbar", className)} {...rest}>
      {items.map((it) => (
        <button key={it.value} className="lu-tab" aria-selected={it.value === value} onClick={() => onChange?.(it.value)}>
          <span className="lu-tab__icon">{it.icon}</span>
          {it.badge ? <span className="lu-tab__badge">{it.badge}</span> : null}
          <span className="lu-tab__label">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
