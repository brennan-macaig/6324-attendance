"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Maximize2, Minimize2, Smartphone, WifiOff } from "lucide-react";

type KioskData =
  | { closed: true }
  | {
      closed: false;
      token: string;
      qrSvg: string;
      windowEndsAt: number;
      serverNow: number;
      receivedAt: number;
      attendees: {
        id: string;
        name: string;
        image: string | null;
        role: string;
        checkedInAt: string;
        checkedOutAt: string | null;
      }[];
    };

const fetcher = async (url: string): Promise<KioskData> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return { ...json, receivedAt: Date.now() };
};

const WINDOW_MS = 30_000;

export function KioskClient({ meetingId, teamName, timeZone }: { meetingId: string; teamName: string; timeZone: string }) {
  const { data, error } = useSWR(`/api/kiosk?m=${meetingId}`, fetcher, {
    refreshInterval: 4000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    const onFs = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  if (data?.closed) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-header-ink/70">{teamName}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.02em] text-white md:text-5xl">This meeting is closed</h1>
        <p className="mt-3 text-lg text-header-ink">Everyone still here was checked out.</p>
        <a
          href="/kiosk"
          className="mt-8 inline-flex h-12 items-center rounded-card bg-white px-6 text-base font-semibold text-brand-950 shadow-pop transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header-active"
        >
          Start a new meeting
        </a>
      </div>
    );
  }

  const live = data && !data.closed ? data : null;
  // Correct for kiosk clock drift using the server's clock.
  const skew = live ? live.serverNow - live.receivedAt : 0;
  const remaining = live ? Math.max(0, live.windowEndsAt - (now + skew)) : 0;
  const here = live?.attendees.filter((a) => !a.checkedOutAt) ?? [];
  const leftCount = (live?.attendees.length ?? 0) - here.length;
  const mentorsHere = here.filter((a) => a.role !== "student").length;
  const studentsHere = here.length - mentorsHere;
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  const urgent = remaining > 0 && remaining < 5000;

  return (
    <div
      ref={rootRef}
      className="relative flex h-[calc(100dvh-3.5rem-4.5rem)] flex-col gap-8 overflow-hidden bg-header px-6 py-6 text-white md:px-10 md:py-8 fullscreen:h-dvh fullscreen:gap-10 fullscreen:px-14 fullscreen:py-12"
    >
      {/* soft depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_15%_-10%,rgb(63_111_230/0.28),transparent_60%),radial-gradient(50rem_40rem_at_110%_110%,rgb(63_111_230/0.16),transparent_60%)]"
      />

      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-header-ink/80 fullscreen:text-base">Check-in</p>
          <h1 className="truncate text-3xl font-semibold tracking-[-0.025em] md:text-[2.75rem] md:leading-tight fullscreen:text-6xl">{teamName}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-5">
          <span className="tabular hidden text-3xl font-medium tracking-[-0.02em] text-header-ink sm:block fullscreen:text-5xl" suppressHydrationWarning>
            {fmt.format(new Date(now + skew))}
          </span>
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void rootRef.current?.requestFullscreen();
            }}
            className="inline-flex h-11 items-center gap-2 rounded-card bg-white/[0.08] px-4 text-[15px] font-medium text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header-active"
          >
            {isFullscreen ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      <div className="relative grid min-h-0 flex-1 items-stretch gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
        {/* QR */}
        <div className="flex flex-col items-center justify-center gap-5">
          <div className="w-full max-w-[min(62vh,600px)] fullscreen:max-w-[min(68vh,760px)]">
            <div
              className="aspect-square w-full rounded-[28px] bg-white p-5 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.55)] ring-1 ring-white/20 transition-opacity [&>svg]:h-full [&>svg]:w-full"
              style={{ opacity: live ? 1 : 0.35 }}
              role="img"
              aria-label="Check-in QR code. Scan with your phone camera."
              // SVG is generated server-side by the `qrcode` library from our own URL.
              dangerouslySetInnerHTML={live ? { __html: live.qrSvg } : undefined}
            />
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
              <div
                className={`h-full rounded-full transition-[width] duration-200 ease-linear ${urgent ? "bg-brand-300" : "bg-header-active"}`}
                style={{ width: `${(remaining / WINDOW_MS) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-center">
            <p className="flex items-center justify-center gap-2.5 text-2xl font-semibold tracking-[-0.01em] md:text-3xl fullscreen:text-4xl">
              <Smartphone className="size-7 text-header-active" aria-hidden />
              Scan with your phone camera
            </p>
            <p className="mt-2 text-lg text-header-ink fullscreen:text-xl" aria-live="off">
              {error ? (
                <span className="inline-flex items-center gap-2 text-[#fec84b]">
                  <WifiOff className="size-5" aria-hidden /> Connection problem — retrying…
                </span>
              ) : live ? (
                <>
                  New code in <span className="tabular font-medium text-white">{Math.ceil(remaining / 1000)}s</span>
                </>
              ) : (
                "Loading code…"
              )}
            </p>
          </div>
        </div>

        {/* Attendees */}
        <div className="flex min-h-0 flex-col rounded-[24px] bg-white/[0.04] p-6 ring-1 ring-inset ring-white/10 md:p-8">
          <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.01em] md:text-3xl fullscreen:text-4xl">Here now</h2>
              <p className="mt-1 text-lg text-header-ink fullscreen:text-xl">{leftCount > 0 ? `${leftCount} already left` : "Welcome in!"}</p>
            </div>
            <div className="text-right">
              <span className="block text-7xl font-semibold leading-[0.85] tracking-[-0.04em] md:text-8xl fullscreen:text-[9rem]" aria-live="polite">
                {here.length}
              </span>
              {here.length > 0 ? (
                <p className="tabular mt-1 text-base text-header-ink fullscreen:text-lg">
                  {studentsHere} {studentsHere === 1 ? "student" : "students"} · {mentorsHere} {mentorsHere === 1 ? "mentor" : "mentors"}
                </p>
              ) : null}
            </div>
          </div>
          <ul className="-mr-2 mt-5 grid min-h-0 flex-1 auto-rows-min grid-cols-1 content-start gap-2.5 overflow-y-auto pr-2 sm:grid-cols-2 [scrollbar-width:thin]">
            {here.map((a) => (
              <li
                key={a.id}
                className="animate-fade-in-up flex items-center justify-between gap-3 rounded-card bg-white/[0.07] px-4 py-3.5 ring-1 ring-inset ring-white/[0.08] fullscreen:py-4"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="size-2.5 shrink-0 rounded-full bg-[#4ade80] shadow-[0_0_0_4px_rgb(74_222_128/0.15)]" aria-hidden />
                  <span className="truncate text-xl font-semibold tracking-[-0.01em] fullscreen:text-2xl">{a.name}</span>
                </span>
                <span className="tabular shrink-0 text-base text-header-ink fullscreen:text-lg">{fmt.format(new Date(a.checkedInAt))}</span>
              </li>
            ))}
            {live && here.length === 0 ? (
              <li className="col-span-full py-10 text-center text-xl text-header-ink">No one yet. Be the first to scan!</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
