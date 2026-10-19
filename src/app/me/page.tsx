import { CalendarClock, Clock, QrCode } from "lucide-react";
import { db } from "@/db";
import { getCheckin, getOpenMeeting, statusOf } from "@/lib/attendance";
import { requirePageUser } from "@/lib/authz";
import { formatCutoff } from "@/lib/cutoff";
import { env } from "@/lib/env";
import { confirmationMessage } from "@/lib/greetings";
import { attendancePct, checkinDurationMs, elapsedMs, formatDuration, formatHours } from "@/lib/hours";
import { firstName } from "@/lib/names";
import { getCurrentSeason, studentSeasonDetail } from "@/lib/queries";
import { runSweep } from "@/lib/sweep";
import { targetProgress, targetVisibleToStudents } from "@/lib/target";
import { formatShortDate, formatTime, isoDateInTz } from "@/lib/time";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConfirmationCard } from "@/components/confirmation";
import { Badge, Card, EmptyState, FlagBadges, LiveDot, PageHeader, StatusBadge, TargetProgressBar } from "@/components/ui";
import { selfCheckOutAction } from "../checkin/actions";

export const metadata = { title: "My attendance" };

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const user = await requirePageUser("student", "/me");
  const sp = await searchParams;
  const tz = env.teamTimezone;
  const cutoff = env.dailyCutoff;
  await runSweep();
  const [meeting, season] = await Promise.all([getOpenMeeting(db), getCurrentSeason(db)]);
  const checkin = meeting ? await getCheckin(db, user.id, meeting.id) : null;
  const status = statusOf(checkin);
  const detail = season ? await studentSeasonDetail(db, user.id, season.id) : [];
  const now = new Date();
  const held = detail.filter((d) => d.meeting.startsAt <= now);
  const attended = detail.filter((d) => d.checkin);
  const duration = (c: { checkedInAt: Date; checkedOutAt: Date | null }) => checkinDurationMs(c.checkedInAt, c.checkedOutAt, cutoff);
  const totalMs = attended.reduce((sum, d) => sum + duration(d.checkin!), 0);
  const showTarget = targetVisibleToStudents(season, isoDateInTz(now, tz));
  const progress = showTarget ? targetProgress(totalMs, season?.hoursTarget) : null;
  const pct = Math.round(attendancePct(attended.length, held.length));
  const name = firstName(user);

  const done = sp.done === "in" || sp.done === "out" ? sp.done : null;
  // The check-in this confirmation is about: the open meeting's, else the most recent one.
  const recent = checkin ?? attended[0]?.checkin ?? null;
  const message = done
    ? confirmationMessage({
        now,
        tz,
        firstName: name,
        seed: recent?.id ?? isoDateInTz(now, tz),
        context:
          done === "in"
            ? { kind: "in", firstOfSeason: attended.length === 1 && !!recent && attended[0].checkin!.id === recent.id }
            : {
                kind: "out",
                sessionMs: recent?.checkedOutAt ? duration(recent) : null,
                seasonMsAfter: totalMs,
                hoursTarget: showTarget ? season?.hoursTarget : null,
              },
      })
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-5">
      <AutoRefresh intervalMs={30_000} />
      {done && message ? (
        <ConfirmationCard kind={done} message={message} seasonHours={season ? formatHours(totalMs) : null} progress={progress} />
      ) : (
        <PageHeader title={`Hi, ${name}`} subtitle={season ? season.name : "No current season"} />
      )}

      {done === "out" ? null : (
      <Card>
        {!meeting ? (
          <StatusRow icon={<CalendarClock className="size-5" aria-hidden />} title="No meeting right now">
            When a meeting starts, scan the QR code on the kiosk to check in.
          </StatusRow>
        ) : status === "not_checked_in" ? (
          <StatusRow icon={<QrCode className="size-5" aria-hidden />} tone="accent" title="A meeting is open">
            Scan the QR code on the kiosk screen to check in.
          </StatusRow>
        ) : status === "checked_in" ? (
          <div>
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-soft ring-1 ring-success-line">
                <LiveDot className="size-2.5 [&>span]:size-2.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-semibold tracking-[-0.01em]">You&apos;re checked in</p>
                <p className="mt-0.5 text-sm text-ink-2">
                  Since <span className="tabular font-medium text-ink">{formatTime(checkin!.checkedInAt, tz)}</span>
                  <span className="text-ink-3"> · </span>
                  <span className="tabular">{formatDuration(elapsedMs(checkin!.checkedInAt, now))}</span> so far
                </p>
              </div>
            </div>
            <ActionForm
              action={selfCheckOutAction}
              confirm="Check out now? You can't check back in to this meeting yourself."
              className="mt-5 space-y-2 [&_button]:w-full sm:[&_button]:w-auto"
            >
              <SubmitButton variant="danger-soft" size="lg" pendingText="Checking out…">
                Check out
              </SubmitButton>
            </ActionForm>
            <p className="mt-3 text-xs leading-relaxed text-ink-3">
              Forgot? You&apos;ll be checked out automatically when the meeting closes, or at {formatCutoff(cutoff)} at the latest.
            </p>
          </div>
        ) : (
          <StatusRow icon={<Clock className="size-5" aria-hidden />} title={`You checked out at ${formatTime(checkin!.checkedOutAt, tz)}`}>
            {formatDuration(duration(checkin!))} at today&apos;s meeting. See you next time!
          </StatusRow>
        )}
      </Card>
      )}

      <Card title="This season">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[3rem] font-semibold leading-none tracking-[-0.035em] text-ink">{formatHours(totalMs)}</div>
            <div className="mt-1.5 text-sm text-ink-3">hours</div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 text-right">
            <div>
              <dt className="text-xs text-ink-3">Meetings</dt>
              <dd className="mt-0.5 text-[17px] font-semibold">
                {attended.length}
                <span className="text-sm font-normal text-ink-3"> / {held.length}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Attendance</dt>
              <dd className="mt-0.5 text-[17px] font-semibold">{pct}%</dd>
            </div>
          </dl>
        </div>
        {progress && !done ? (
          <div className="mt-5 border-t border-line pt-4">
            <TargetProgressBar progress={progress} />
          </div>
        ) : null}
      </Card>

      <Card title="History" flush>
        {detail.length === 0 ? (
          <EmptyState icon={<CalendarClock />} title="No meetings yet">
            Meetings you attend this season will show up here.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {detail.map(({ meeting: m, checkin: c }) => (
              <li key={m.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <div className={`text-sm font-medium ${c ? "text-ink" : "text-ink-3"}`}>{formatShortDate(m.startsAt, tz)}</div>
                  <div className="tabular mt-0.5 text-[13px] text-ink-3">
                    {c ? (
                      <>
                        {formatTime(c.checkedInAt, tz)} – {c.checkedOutAt ? formatTime(c.checkedOutAt, tz) : "now"}
                      </>
                    ) : (
                      "Didn't attend"
                    )}
                  </div>
                  {c ? (
                    <div className="mt-1 empty:hidden">
                      <FlagBadges short flags={c.flags.filter((f) => f === "auto_checkout" || f === "auto_checkout_9pm" || f === "manual" || f === "edited")} />
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  {!c ? (
                    <StatusBadge kind="absent" />
                  ) : c.checkedOutAt ? (
                    <span className="tabular text-sm font-semibold text-ink">
                      {formatHours(duration(c), 2)}
                      <span className="ml-0.5 text-xs font-normal text-ink-3">h</span>
                    </span>
                  ) : (
                    <Badge tone="success" icon={<span className="size-1.5 rounded-full bg-success" />}>
                      Here now
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatusRow({ icon, title, children, tone = "neutral" }: { icon: React.ReactNode; title: string; children: React.ReactNode; tone?: "neutral" | "accent" }) {
  return (
    <div className="flex items-start gap-4">
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-full ring-1 ${
          tone === "accent" ? "bg-accent-soft text-accent-ink ring-brand-200 dark:ring-brand-800" : "bg-surface-2 text-ink-3 ring-line"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[17px] font-semibold tracking-[-0.01em]">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{children}</p>
      </div>
    </div>
  );
}
