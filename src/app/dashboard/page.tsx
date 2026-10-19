import Link from "next/link";
import { CalendarOff, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { db } from "@/db";
import { hasRole, requirePageUser } from "@/lib/authz";
import { env } from "@/lib/env";
import { checkinDurationMs, elapsedMs, formatDuration, formatHours } from "@/lib/hours";
import { displayName } from "@/lib/names";
import { dayView, type AttendeeRow, type RosterEntry } from "@/lib/queries";
import { runSweep } from "@/lib/sweep";
import { addDays, dayRangeInTz, formatIsoDate, formatTime, isIsoDate, isoDateInTz } from "@/lib/time";
import { AutoRefresh } from "@/components/auto-refresh";
import { buttonClass } from "@/components/button-class";
import {
  Avatar,
  Card,
  EmptyState,
  FlagBadges,
  LiveDot,
  PageHeader,
  RoleBadge,
  StatGrid,
  StatTile,
  StatusBadge,
  TableScroll,
  linkClass,
  numClass,
  rowLinkClass,
  tableClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";

export const metadata = { title: "Dashboard" };

type Row =
  | { kind: "here" | "left"; person: AttendeeRow["user"]; checkin: AttendeeRow["checkin"] }
  | { kind: "absent"; person: RosterEntry; checkin: null };

const ORDER = { here: 0, left: 1, absent: 2 } as const;

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requirePageUser("student", "/dashboard");
  const isMentor = hasRole(user, "mentor");
  const tz = env.teamTimezone;
  const cutoff = env.dailyCutoff;
  await runSweep();
  const now = new Date();
  const today = isoDateInTz(now, tz);
  const sp = await searchParams;
  // Students only ever see today.
  const date = isMentor && typeof sp.date === "string" && isIsoDate(sp.date) ? sp.date : today;
  const isToday = date === today;
  const view = await dayView(db, dayRangeInTz(date, tz));
  const openMeetingIds = new Set(view.meetings.filter((m) => m.isOpen).map((m) => m.id));

  const here = view.checkins.filter((c) => !c.checkin.checkedOutAt && openMeetingIds.has(c.checkin.meetingId));
  const left = view.checkins.filter((c) => !here.includes(c));
  const byName = <T extends { person: { name: string | null; email: string; role: string } }>(a: T, b: T) =>
    displayName(a.person).localeCompare(displayName(b.person));

  if (!isMentor) {
    const people = here.map((h) => ({ person: h.user })).sort(byName);
    return (
      <div className="mx-auto max-w-2xl">
        <AutoRefresh intervalMs={10_000} />
        <PageHeader title="Who's here" subtitle={formatIsoDate(today)} />
        <Card
          flush
          title={
            <span className="flex items-center gap-2">
              {here.length ? <LiveDot /> : null}
              Here now
            </span>
          }
          actions={<span className="tabular text-sm font-semibold text-ink">{here.length}</span>}
        >
          {people.length === 0 ? (
            <EmptyState icon={<Users />} title="Nobody is checked in right now">
              When people check in at the kiosk, they&apos;ll show up here.
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
              {people.map((r) => (
                <li key={r.person.id} className="flex min-h-14 items-center gap-3 bg-surface px-5 py-2.5">
                  <Avatar name={displayName(r.person)} image={r.person.image} size={32} />
                  <span className="truncate text-[15px] font-medium">{displayName(r.person)}</span>
                </li>
              ))}
              {people.length % 2 === 1 ? <li className="hidden bg-surface sm:block" aria-hidden /> : null}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  const rows: Row[] = [
    ...here.map((c) => ({ kind: "here" as const, person: c.user, checkin: c.checkin })),
    ...left.map((c) => ({ kind: "left" as const, person: c.user, checkin: c.checkin })),
    ...view.absent.map((p) => ({ kind: "absent" as const, person: p, checkin: null })),
  ].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || byName(a, b));
  const flaggedCount = view.checkins.filter((c) => c.checkin.flags.some((f) => f === "off_network" || f === "shared_device" || f === "no_device")).length;
  const meetingsHint =
    view.meetings.map((m) => `${formatTime(m.startsAt, tz)}${m.isOpen ? " (open)" : `–${formatTime(m.endsAt, tz)}`}`).join(", ") || "None";

  return (
    <div className="space-y-6">
      {isToday ? <AutoRefresh intervalMs={10_000} /> : null}
      <PageHeader
        title="Day view"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            {formatIsoDate(date)}
            {isToday ? (
              <span className="inline-flex items-center gap-1.5 text-ink-3">
                <LiveDot /> Live · updates every 10s
              </span>
            ) : null}
          </span>
        }
        actions={
          <form method="get" className="flex items-center gap-2">
            <div className="flex h-9 items-stretch overflow-hidden rounded-control border border-line-strong bg-surface shadow-xs">
              <Link
                href={`/dashboard?date=${addDays(date, -1)}`}
                className="flex w-9 items-center justify-center text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                aria-label="Previous day"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
              <label className="sr-only" htmlFor="date">
                Date
              </label>
              <input
                id="date"
                type="date"
                name="date"
                defaultValue={date}
                max={today}
                className="tabular w-[9.5rem] border-x border-line bg-transparent px-2.5 text-sm text-ink focus:outline-2 focus:-outline-offset-2 focus:outline-ring [color-scheme:light] dark:[color-scheme:dark]"
              />
              {date < today ? (
                <Link
                  href={`/dashboard?date=${addDays(date, 1)}`}
                  className="flex w-9 items-center justify-center text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  aria-label="Next day"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              ) : (
                <span className="flex w-9 items-center justify-center text-ink-3/40" aria-hidden>
                  <ChevronRight className="size-4" />
                </span>
              )}
            </div>
            <button type="submit" className={buttonClass("secondary", "md")}>
              Go
            </button>
            {!isToday ? (
              <Link href="/dashboard" className={buttonClass("primary", "md")}>
                Today
              </Link>
            ) : null}
          </form>
        }
      />

      <StatGrid>
        <StatTile label="Here now" value={here.length} indicator={here.length ? "live" : undefined} />
        <StatTile label="Checked in this day" value={view.checkins.length} />
        <StatTile label="Absent students" value={view.absent.length} />
        <StatTile label="Meetings" value={view.meetings.length} hint={meetingsHint} />
      </StatGrid>

      {view.meetings.length === 0 && view.checkins.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarOff />}
            title="No meeting on this day"
            action={
              isToday ? (
                <Link className={buttonClass("primary", "md")} href="/kiosk">
                  Start one from the kiosk
                </Link>
              ) : (
                <Link className={linkClass} href="/dashboard">
                  Back to today
                </Link>
              )
            }
          >
            {isToday ? "Nobody has checked in yet today." : "Nobody checked in on this day."}
          </EmptyState>
        </Card>
      ) : (
        <Card
          flush
          title="Attendance"
          actions={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="tabular">{here.length} here</span>
              <span className="tabular">{left.length} left</span>
              <span className="tabular">{view.absent.length} absent</span>
              {flaggedCount ? <span className="tabular font-medium text-warning-ink">{flaggedCount} flagged</span> : null}
            </span>
          }
        >
          <TableScroll>
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th scope="col" className={thClass}>
                    Name
                  </th>
                  <th scope="col" className={thClass}>
                    Status
                  </th>
                  <th scope="col" className={`${thClass} ${numClass}`}>
                    In
                  </th>
                  <th scope="col" className={`${thClass} ${numClass}`}>
                    Out
                  </th>
                  <th scope="col" className={`${thClass} ${numClass}`}>
                    Time
                  </th>
                  <th scope="col" className={`${thClass} w-full`}>
                    Flags
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.person.id}-${r.checkin?.id ?? "absent"}`} className={trClass}>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <Link href={`/admin/students/${r.person.id}`} className={`flex items-center gap-2.5 ${rowLinkClass} ${r.kind === "absent" ? "text-ink-2" : ""}`}>
                        <Avatar name={displayName(r.person)} image={r.person.image} size={26} />
                        {displayName(r.person)}
                        {r.person.role !== "student" ? <RoleBadge role={r.person.role} /> : null}
                      </Link>
                    </td>
                    <td className={tdClass}>
                      <StatusBadge kind={r.kind} />
                    </td>
                    <td className={`${tdClass} ${numClass} whitespace-nowrap text-ink-2`}>{r.checkin ? formatTime(r.checkin.checkedInAt, tz) : <Dash />}</td>
                    <td className={`${tdClass} ${numClass} whitespace-nowrap text-ink-2`}>
                      {r.checkin?.checkedOutAt ? formatTime(r.checkin.checkedOutAt, tz) : <Dash />}
                    </td>
                    <td className={`${tdClass} ${numClass} whitespace-nowrap font-medium`}>
                      {r.checkin ? (
                        r.checkin.checkedOutAt ? (
                          `${formatHours(checkinDurationMs(r.checkin.checkedInAt, r.checkin.checkedOutAt, cutoff), 1)}h`
                        ) : (
                          formatDuration(elapsedMs(r.checkin.checkedInAt, now))
                        )
                      ) : (
                        <Dash />
                      )}
                    </td>
                    <td className={tdClass}>{r.checkin ? <FlagBadges short flags={r.checkin.flags} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      )}
    </div>
  );
}

function Dash() {
  return <span className="text-ink-3/60">—</span>;
}
