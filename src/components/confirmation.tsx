import { Check, LogOut, PartyPopper, Sparkles } from "lucide-react";
import type { ConfirmationMessage } from "@/lib/greetings";
import type { TargetProgress } from "@/lib/target";
import { TargetProgressBar } from "./ui";

/**
 * Check-in / check-out success: greeting, upbeat line (or milestone), session
 * length, then season hours (and target progress once it's visible to students).
 */
export function ConfirmationCard({
  kind,
  message,
  seasonHours,
  progress,
}: {
  kind: "in" | "out";
  message: ConfirmationMessage;
  seasonHours: string | null;
  progress: TargetProgress | null;
}) {
  const milestone = message.milestone;
  return (
    <section
      role="status"
      className="animate-fade-in-up overflow-hidden rounded-panel border border-line bg-surface shadow-card"
    >
      <div className="relative px-5 pb-5 pt-6 text-center sm:px-8 sm:pt-8">
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 h-28 ${kind === "in" ? "bg-gradient-to-b from-success-soft to-transparent" : "bg-gradient-to-b from-accent-soft to-transparent"}`}
        />
        <div
          className={`relative mx-auto flex size-14 items-center justify-center rounded-full text-white shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)] ${
            kind === "in" ? "bg-success-solid" : "bg-accent"
          }`}
        >
          {kind === "in" ? <Check className="size-7" strokeWidth={2.75} aria-hidden /> : <LogOut className="size-6" strokeWidth={2.5} aria-hidden />}
        </div>
        <p className="relative mt-4 text-[13px] font-medium uppercase tracking-[0.06em] text-ink-3">
          {kind === "in" ? "You're checked in" : "You're checked out"}
        </p>
        <h2 className="relative mt-1 text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-ink">{message.greeting}</h2>
        {milestone ? (
          <p
            className={`relative mx-auto mt-3 inline-flex max-w-md items-center gap-2 rounded-[14px] px-3.5 py-2 text-left text-[15px] font-medium ring-1 ring-inset ${
              milestone.kind === "target" ? "bg-success-soft text-success-ink ring-success-line" : "bg-accent-soft text-accent-ink ring-brand-200 dark:ring-brand-800"
            }`}
          >
            {milestone.kind === "first" ? (
              <Sparkles className="size-4 shrink-0" aria-hidden />
            ) : milestone.kind === "hours" ? (
              <PartyPopper className="size-4 shrink-0" aria-hidden />
            ) : null}
            {message.line}
          </p>
        ) : (
          <p className="relative mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-ink-2">{message.line}</p>
        )}
        {message.session ? <p className="relative mt-3 text-sm font-medium text-ink">{message.session}</p> : null}
      </div>
      {seasonHours !== null ? (
        <div className="border-t border-line bg-surface-2 px-5 py-4 sm:px-8">
          {progress ? (
            <TargetProgressBar progress={progress} size="lg" />
          ) : (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-ink-2">Season hours</span>
              <span className="text-[15px] font-semibold text-ink">
                <span className="tabular">{seasonHours}</span> hrs
              </span>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
