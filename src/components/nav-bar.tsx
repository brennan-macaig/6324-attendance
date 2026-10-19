"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  ChartColumn,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  UserRound,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { signOutAction } from "@/app/auth-actions";
import { Avatar } from "./ui";

export type NavLink = { href: string; label: string; icon: keyof typeof ICONS; also?: string[] };

const ICONS = {
  me: UserRound,
  people: Users,
  dashboard: LayoutDashboard,
  kiosk: QrCode,
  meetings: CalendarDays,
  hours: ChartColumn,
  roster: UsersRound,
  seasons: CalendarRange,
} satisfies Record<string, LucideIcon>;

type NavUser = { name: string; email: string; role: string; image: string | null };

const isActive = (pathname: string, l: NavLink) =>
  [l.href, ...(l.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Close a popover on outside click / Escape / navigation. */
function usePopover(pathname: string) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return [open, setOpen, ref] as const;
}

export function NavBar({ team, links, user }: { team: string; links: NavLink[]; user: NavUser | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen, menuRef] = usePopover(pathname);
  const [accountOpen, setAccountOpen, accountRef] = usePopover(pathname);
  // Students have two destinations: show them as a segmented tab bar on mobile.
  const compact = links.length > 0 && links.length <= 2;

  return (
    <header className="sticky top-0 z-40 bg-header text-header-ink shadow-[0_1px_0_0_var(--header-line)] print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        {!compact && links.length ? (
          <div ref={menuRef} className="md:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              className="-ml-1.5 inline-flex size-9 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-header-active"
            >
              {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
              <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
            </button>
            {menuOpen ? (
              <nav
                id="mobile-nav"
                aria-label="Main"
                className="animate-pop-in absolute inset-x-0 top-14 border-b border-header-line bg-header px-3 pb-4 pt-2 shadow-pop"
              >
                <ul className="grid gap-0.5">
                  {links.map((l) => {
                    const Icon = ICONS[l.icon];
                    const active = isActive(pathname, l);
                    return (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          aria-current={active ? "page" : undefined}
                          className={`flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors ${
                            active ? "bg-white/10 text-white" : "text-header-ink hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <Icon className={`size-[18px] ${active ? "text-header-active" : "text-header-ink/70"}`} aria-hidden />
                          {l.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            ) : null}
          </div>
        ) : null}

        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-lg pr-1 focus-visible:outline-2 focus-visible:outline-header-active"
        >
          <BrandMark />
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-white">{team}</span>
        </Link>

        {links.length ? (
          <nav aria-label="Main" className="ml-4 hidden h-full items-stretch gap-1 md:flex">
            {links.map((l) => {
              const active = isActive(pathname, l);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center px-2.5 text-sm font-medium transition-colors focus-visible:outline-none ${
                    active ? "text-white" : "text-header-ink hover:text-white"
                  }`}
                >
                  <span className="rounded-md px-1 py-1 group-focus-visible:outline-2 group-focus-visible:outline-header-active">{l.label}</span>
                  <span
                    aria-hidden
                    className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-colors ${active ? "bg-header-active" : "bg-transparent group-hover:bg-white/15"}`}
                  />
                </Link>
              );
            })}
          </nav>
        ) : null}

        <div className="ml-auto flex items-center">
          {user ? (
            <div ref={accountRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((o) => !o)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-header-active sm:pr-2.5"
              >
                <Avatar name={user.name} image={user.image} size={28} />
                <span className="hidden max-w-40 truncate text-sm font-medium text-white sm:inline">{user.name}</span>
                <ChevronDown className="hidden size-4 text-header-ink sm:block" aria-hidden />
                <span className="sr-only">Account menu</span>
              </button>
              {accountOpen ? (
                <div
                  role="menu"
                  className="animate-pop-in absolute right-0 top-11 w-64 origin-top-right overflow-hidden rounded-card border border-line bg-surface text-ink shadow-pop"
                >
                  <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                    <Avatar name={user.name} image={user.image} size={36} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{user.name}</div>
                      <div className="truncate text-xs text-ink-3">{user.email}</div>
                    </div>
                  </div>
                  <div className="px-4 py-2 text-xs text-ink-3">
                    Signed in as <span className="font-medium capitalize text-ink-2">{user.role}</span>
                  </div>
                  <form action={signOutAction} className="border-t border-line p-1.5">
                    <button
                      type="submit"
                      role="menuitem"
                      className="flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <LogOut className="size-4" aria-hidden />
                      Sign out
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {compact ? (
        <nav aria-label="Main" className="mx-auto max-w-6xl px-4 pb-2 sm:px-6 md:hidden">
          <ul className="grid grid-flow-col auto-cols-fr gap-1 rounded-[10px] bg-white/[0.07] p-1">
            {links.map((l) => {
              const Icon = ICONS[l.icon];
              const active = isActive(pathname, l);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-header-active ${
                      active ? "bg-white text-brand-950 shadow-xs" : "text-header-ink hover:text-white"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden />
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-b from-brand-400 to-brand-600 shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.3)]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ width: size * 0.6, height: size * 0.6 }}>
        <path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12L13 2z" />
      </svg>
    </span>
  );
}
