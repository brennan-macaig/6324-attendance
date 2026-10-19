import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ChevronLeft, CircleCheck, Info, ShieldAlert } from "lucide-react";
import { FLAG_LABELS } from "@/lib/flags";
import { targetLabel, type TargetProgress } from "@/lib/target";
import { signInWithGoogle } from "@/app/auth-actions";
import { buttonClass, type ButtonSize } from "./button-class";

/* ------------------------------------------------------------------ layout */

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-6 sm:mb-8">
      {back ? (
        <Link
          href={back.href}
          className="-ml-1 mb-3 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {eyebrow ? <div className="mb-1 text-[13px] font-medium text-ink-3">{eyebrow}</div> : null}
          <h1 className="text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[1.75rem]">{title}</h1>
          {subtitle ? <div className="mt-1.5 text-sm text-ink-2">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Card({
  title,
  description,
  children,
  className,
  actions,
  flush,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  /** No body padding (tables, lists that run edge to edge). */
  flush?: boolean;
}) {
  const hasHeader = title || actions || description;
  return (
    <section className={`overflow-clip rounded-card border border-line bg-surface shadow-card ${className ?? ""}`}>
      {hasHeader ? (
        <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 ${flush ? "border-b border-line py-3.5" : "pt-4"}`}>
          <div className="min-w-0">
            {title ? <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[13px] text-ink-3">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2 text-[13px] text-ink-3">{actions}</div> : null}
        </div>
      ) : null}
      <div className={flush ? "" : hasHeader ? "px-5 pb-5 pt-3" : "p-5"}>{children}</div>
    </section>
  );
}

/** Stat tile: label (sentence case), value (proportional figures), optional hint. */
export function StatTile({
  label,
  value,
  hint,
  indicator,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  indicator?: "live" | "warning";
}) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3.5 shadow-card sm:px-5 sm:py-4">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
        {indicator === "live" ? <LiveDot /> : null}
        {indicator === "warning" ? <AlertTriangle className="size-3.5 text-warning" aria-hidden /> : null}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 text-[1.625rem] font-semibold leading-none tracking-[-0.02em] text-ink sm:text-[1.75rem]">{value}</div>
      {hint ? <div className="mt-2 truncate text-xs text-ink-3">{hint}</div> : null}
    </div>
  );
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 }) {
  return <div className={`grid grid-cols-2 gap-3 ${cols === 4 ? "lg:grid-cols-4" : "sm:grid-cols-3"}`}>{children}</div>;
}

/** Pulsing green dot for "live" things. Decorative. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={`relative inline-flex size-2 shrink-0 ${className ?? ""}`} aria-hidden>
      <span className="animate-soft-ping absolute inset-0 rounded-full bg-success" />
      <span className="relative inline-flex size-2 rounded-full bg-success" />
    </span>
  );
}

/* ------------------------------------------------------------------ badges */

export type Tone = "neutral" | "success" | "warning" | "danger" | "accent" | "violet";

const toneClass: Record<Tone, string> = {
  neutral: "bg-neutral-soft text-neutral-ink ring-neutral-line",
  success: "bg-success-soft text-success-ink ring-success-line",
  warning: "bg-warning-soft text-warning-ink ring-warning-line",
  danger: "bg-danger-soft text-danger-ink ring-danger-line",
  accent: "bg-accent-soft text-accent-ink ring-brand-200 dark:ring-brand-800",
  violet: "bg-[#f4f0ff] text-[#5b3fc4] ring-[#ddd3fe] dark:bg-[#7c5cff]/15 dark:text-[#c4b5fd] dark:ring-[#7c5cff]/30",
};

export function Badge({ tone = "neutral", children, title, icon }: { tone?: Tone; children: ReactNode; title?: string; icon?: ReactNode }) {
  return (
    <span title={title} className={`inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium ring-1 ring-inset ${toneClass[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

export type PresenceKind = "here" | "left" | "absent";

/** Here (green dot), Left (neutral filled dot), Absent (muted, hollow dot). Always labelled. */
export function StatusBadge({ kind }: { kind: PresenceKind }) {
  if (kind === "here") {
    return (
      <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-success-soft px-2 text-xs font-medium text-success-ink ring-1 ring-inset ring-success-line">
        <span className="size-1.5 rounded-full bg-success" aria-hidden />
        Here
      </span>
    );
  }
  if (kind === "left") {
    return (
      <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-neutral-soft px-2 text-xs font-medium text-neutral-ink ring-1 ring-inset ring-neutral-line">
        <span className="size-1.5 rounded-full bg-ink-3" aria-hidden />
        Left
      </span>
    );
  }
  return (
    <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-xs font-medium text-ink-3 ring-1 ring-inset ring-line-strong">
      <span className="size-1.5 rounded-full ring-1 ring-inset ring-ink-3" aria-hidden />
      Absent
    </span>
  );
}

const flagTone: Record<string, Tone> = {
  off_network: "warning",
  no_device: "warning",
  shared_device: "danger",
  auto_checkout_9pm: "warning",
};

const SHORT_FLAG_LABELS: Record<string, string> = {
  off_network: "Off network",
  shared_device: "Shared device",
  auto_checkout: "Auto checkout",
  auto_checkout_9pm: "9 PM auto checkout",
  manual: "Manual",
  edited: "Edited",
  self_checkout: "Self checkout",
  no_device: "No device ID",
};

export function FlagBadges({ flags, short }: { flags: string[]; short?: boolean }) {
  if (!flags.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {flags.map((f) => {
        const tone = flagTone[f] ?? "neutral";
        const Icon = tone === "danger" ? ShieldAlert : tone === "warning" ? AlertTriangle : Info;
        return (
          <Badge key={f} tone={tone} title={FLAG_LABELS[f] ?? f} icon={tone === "neutral" ? null : <Icon className="size-3" aria-hidden />}>
            {short ? (SHORT_FLAG_LABELS[f] ?? FLAG_LABELS[f] ?? f) : (FLAG_LABELS[f] ?? f)}
          </Badge>
        );
      })}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const tone: Tone = role === "admin" ? "accent" : role === "mentor" ? "violet" : "neutral";
  return (
    <Badge tone={tone}>
      <span className="capitalize">{role}</span>
    </Badge>
  );
}

/** Met / not-met pill for a season hours target. */
export function TargetBadge({ progress }: { progress: TargetProgress | null }) {
  if (!progress) return null;
  return progress.met ? (
    <Badge tone="success" icon={<CircleCheck className="size-3" aria-hidden />}>
      Met
    </Badge>
  ) : (
    <Badge tone="neutral">
      <span className="tabular">{fmtHrs(progress.remaining)}</span> to go
    </Badge>
  );
}

const fmtHrs = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Progress toward the hours target: label + bar (bar is decorative; the label carries the value). */
export function TargetProgressBar({ progress, size = "md" }: { progress: TargetProgress; size?: "md" | "lg" }) {
  return (
    <div>
      <div className={`flex items-baseline justify-between gap-3 ${size === "lg" ? "text-[15px]" : "text-sm"}`}>
        <span className={`font-medium ${progress.met ? "text-success-ink" : "text-ink"}`}>
          {progress.met ? (
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck className="size-4" aria-hidden />
              Minimum met
            </span>
          ) : (
            <span className="tabular">{targetLabel(progress)}</span>
          )}
        </span>
        <span className="tabular shrink-0 text-xs text-ink-3">
          {progress.met ? `${fmtHrs(progress.hours)} / ${fmtHrs(progress.target)} hrs` : `${Math.floor(progress.pct)}%`}
        </span>
      </div>
      <div
        className={`mt-2 overflow-hidden rounded-full bg-accent-soft ${size === "lg" ? "h-2.5" : "h-2"}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.target}
        aria-valuenow={Math.min(progress.hours, progress.target)}
        aria-label="Hours toward season minimum"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out-soft ${progress.met ? "bg-success" : "bg-accent"}`}
          style={{ width: `${Math.max(progress.pct, progress.hours > 0 ? 2 : 0)}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ people */

export function Avatar({ name, image, size = 32 }: { name: string; image?: string | null; size?: number }) {
  const initials = name
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .map((p) => Array.from(p)[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" width={size} height={size} referrerPolicy="no-referrer" className="shrink-0 rounded-full ring-1 ring-line" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-200"
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
    >
      {initials || "?"}
    </span>
  );
}

/* ------------------------------------------------------------------ misc */

export function GoogleSignIn({ callbackUrl, size = "lg" }: { callbackUrl?: string; size?: ButtonSize }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
      <button type="submit" className={buttonClass("secondary", size)}>
        <GoogleMark />
        Sign in with Google
      </button>
    </form>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function EmptyState({ children, title, icon, action }: { children?: ReactNode; title?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon ? <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink-3 ring-1 ring-line [&>svg]:size-5">{icon}</div> : null}
      {title ? <p className="text-sm font-medium text-ink">{title}</p> : null}
      {children ? <div className={`max-w-sm text-sm text-ink-3 ${title ? "mt-1" : ""}`}>{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Inline link in body copy. */
export const linkClass =
  "font-medium text-accent-ink underline decoration-accent-ink/30 underline-offset-2 transition-colors hover:decoration-accent-ink focus-visible:outline-2 focus-visible:outline-ring rounded-sm";

/** Name-style link in tables (no underline until hover). */
export const rowLinkClass = "font-medium text-ink hover:text-accent-ink hover:underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring rounded-sm";

/* ------------------------------------------------------------------ forms */

export const inputClass =
  "block h-9 w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-ink shadow-xs placeholder:text-ink-3 transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:ring-3 focus:ring-ring/25 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3 [color-scheme:light] dark:[color-scheme:dark]";

export const selectClass = `${inputClass} appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E")] bg-[length:1.1rem] bg-[right_0.5rem_center] bg-no-repeat pr-8`;

export const textareaClass = inputClass.replace("h-9 ", "min-h-24 py-2 ");

export const labelClass = "block text-[13px] font-medium text-ink-2";

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={labelClass}>{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {hint ? <span className="mt-1.5 block text-xs text-ink-3">{hint}</span> : null}
    </label>
  );
}

/* ------------------------------------------------------------------ tables */

/**
 * Table wrapper: scrolls horizontally on small screens; from md up it doesn't
 * create a scroll container, so the header sticks below the app header while
 * the page scrolls (cards use overflow: clip, which keeps sticky working).
 */
export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto overscroll-x-contain md:overflow-x-visible">{children}</div>;
}

export const tableClass = "min-w-full border-separate border-spacing-0 text-sm";
export const theadClass = "md:sticky md:top-14 md:z-10";
export const thClass =
  "h-10 whitespace-nowrap border-b border-line bg-surface-2 px-3 text-left align-middle text-xs font-medium text-ink-3 first:pl-5 last:pr-5";
export const tdClass = "border-b border-line px-3 py-2.5 align-middle text-ink first:pl-5 last:pr-5 [tr:last-child>&]:border-b-0";
export const trClass = "transition-colors hover:bg-surface-hover";
/** Right-aligned numeric cell. */
export const numClass = "tabular text-right";
