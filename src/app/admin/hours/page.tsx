import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, CalendarRange, Users } from "lucide-react";
import { db } from "@/db";
import type { Role } from "@/db/schema";
import { requirePageUser } from "@/lib/authz";
import { env } from "@/lib/env";
import { formatHours, msToHours } from "@/lib/hours";
import { displayName } from "@/lib/names";
import { listMeetings, resolveSeason, seasonReport } from "@/lib/queries";
import { parseSort, sortRows, type SortKey } from "@/lib/report";
import { runSweep } from "@/lib/sweep";
import { fmt, targetProgress } from "@/lib/target";
import { formatDate, formatShortDate } from "@/lib/time";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { buttonClass } from "@/components/button-class";
import { ColumnChart, HorizontalBarChart } from "@/components/charts";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatGrid,
  StatTile,
  TableScroll,
  TargetBadge,
  linkClass,
  numClass,
  rowLinkClass,
  selectClass,
  tableClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";

export const metadata = { title: "Hours" };

export default async function HoursPage({ searchParams }: PageProps<"/admin/hours">) {
  await requirePageUser("mentor", "/admin/hours");
  const sp = await searchParams;
  const tz = env.teamTimezone;
  await runSweep();
  const { seasons, season } = await resolveSeason(db, typeof sp.season === "string" ? sp.season : null);
  const who = sp.who === "all" ? "all" : "students";
  const roles: Role[] = who === "all" ? ["student", "mentor", "admin"] : ["student"];
  const { key, dir } = parseSort(sp.sort, sp.dir);

  if (!season) {
    return (
      <>
        <PageHeader title="Season hours" />
        <Card>
          <EmptyState
            icon={<CalendarRange />}
            title="No seasons yet"
            action={
              <Link href="/admin/seasons" className={buttonClass("primary", "md")}>
                Create a season
              </Link>
            }
          >
            Hours are tracked per season. Create one to get started.
          </EmptyState>
        </Card>
      </>
    );
  }

  const [report, meetingList] = await Promise.all([seasonReport(db, season.id, { roles, cutoff: env.dailyCutoff }), listMeetings(db, season.id)]);
  const rows = sortRows(report.rows, key, dir);
  const totalMs = rows.reduce((s, r) => s + r.totalMs, 0);
  const avgPct = rows.length ? rows.reduce((s, r) => s + r.attendancePct, 0) / rows.length : 0;
  const topHours = [...report.rows].sort((a, b) => b.totalMs - a.totalMs).slice(0, 15);
  const perMeeting = [...meetingList].reverse().map((m) => ({
    id: m.meeting.id,
    label: formatShortDate(m.meeting.startsAt, tz).replace(/^\w+, /, ""),
    value: m.attendees,
  }));
  const target = season.hoursTarget && season.hoursTarget > 0 ? season.hoursTarget : null;
  const metCount = target ? rows.filter((r) => targetProgress(r.totalMs, target)?.met).length : 0;

  const baseQs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ season: season.id, who, sort: key, dir, ...extra });
    return `?${p.toString()}`;
  };
  const sortLink = (k: SortKey) => baseQs({ sort: k, dir: key === k ? (dir === "asc" ? "desc" : "asc") : k === "name" ? "asc" : "desc" });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Season hours"
        subtitle={
          <>
            {season.name} · {formatDate(new Date(`${season.startDate}T12:00:00Z`), "UTC")} – {formatDate(new Date(`${season.endDate}T12:00:00Z`), "UTC")}
          </>
        }
        actions={
          <a href={`/api/admin/hours/export${baseQs({})}`} className={buttonClass("secondary", "md")} download>
            <Download className="size-4" aria-hidden />
            Export CSV
          </a>
        }
      />

      <form method="get" className="-mt-2 flex flex-wrap items-center gap-2" aria-label="Filters">
        <input type="hidden" name="sort" value={key} />
        <input type="hidden" name="dir" value={dir} />
        <label className="sr-only" htmlFor="season">
          Season
        </label>
        <div className="relative">
          <CalendarRange className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <AutoSubmitSelect id="season" name="season" defaultValue={season.id} className={`${selectClass} w-60 pl-8`}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isCurrent ? " (current)" : ""}
              </option>
            ))}
          </AutoSubmitSelect>
        </div>
        <label className="sr-only" htmlFor="who">
          People
        </label>
        <div className="relative">
          <Users className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <AutoSubmitSelect id="who" name="who" defaultValue={who} className={`${selectClass} w-40 pl-8`}>
            <option value="students">Students</option>
            <option value="all">Everyone</option>
          </AutoSubmitSelect>
        </div>
        <noscript>
          <button type="submit" className={buttonClass("secondary", "md")}>
            View
          </button>
        </noscript>
      </form>

      <StatGrid>
        <StatTile label="Total team hours" value={formatHours(totalMs, 0)} />
        <StatTile label="Meetings held" value={report.meetingsHeld} />
        <StatTile label="Average attendance" value={`${Math.round(avgPct)}%`} />
        {target ? (
          <StatTile label={`Met ${fmt(target)}-hour minimum`} value={`${metCount} / ${rows.length}`} hint={who === "all" ? "Everyone shown" : "Students"} />
        ) : (
          <StatTile label={who === "all" ? "People" : "Students"} value={rows.length} />
        )}
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <HorizontalBarChart
            title="Hours per student"
            description="Top 15 this season, completed check-ins only"
            data={topHours.map((r) => ({
              id: r.user.id,
              label: displayName(r.user),
              value: msToHours(r.totalMs),
              display: `${formatHours(r.totalMs)}h`,
            }))}
          />
        </Card>
        <Card>
          <ColumnChart title="Attendance per meeting" description="People checked in, oldest to newest" unit="people" data={perMeeting} />
          {perMeeting.length ? (
            <dl className="mt-6 grid grid-cols-3 divide-x divide-line border-t border-line pt-4 text-center">
              {[
                ["Average", (perMeeting.reduce((s, m) => s + m.value, 0) / perMeeting.length).toFixed(1)],
                ["Highest", String(Math.max(...perMeeting.map((m) => m.value)))],
                ["Lowest", String(Math.min(...perMeeting.map((m) => m.value)))],
              ].map(([label, value]) => (
                <div key={label} className="px-2">
                  <dt className="text-xs text-ink-3">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold tracking-[-0.01em] text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </Card>
      </div>

      <Card
        flush
        title={who === "all" ? "Everyone" : "All students"}
        description={target ? `Season minimum: ${fmt(target)} hours` : undefined}
        actions={<span className="tabular">{rows.length} people</span>}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="No one on the roster yet"
            action={
              <Link href="/admin/roster" className={linkClass}>
                Go to roster
              </Link>
            }
          />
        ) : (
          <TableScroll>
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <Th k="name" current={key} dir={dir} href={sortLink("name")}>
                    Name
                  </Th>
                  <Th k="hours" right current={key} dir={dir} href={sortLink("hours")}>
                    Hours
                  </Th>
                  {target ? (
                    <th scope="col" className={thClass}>
                      Minimum
                    </th>
                  ) : null}
                  <Th k="meetings" right current={key} dir={dir} href={sortLink("meetings")}>
                    Meetings
                  </Th>
                  <Th k="pct" right current={key} dir={dir} href={sortLink("pct")}>
                    Attendance
                  </Th>
                  <Th k="last" right current={key} dir={dir} href={sortLink("last")}>
                    Last seen
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user.id} className={trClass}>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <span className="flex items-center gap-2">
                        <Link href={`/admin/students/${r.user.id}?season=${season.id}`} className={rowLinkClass}>
                          {displayName(r.user)}
                        </Link>
                        {r.inProgress ? (
                          <Badge tone="success" icon={<span className="size-1.5 rounded-full bg-success" aria-hidden />}>
                            Here
                          </Badge>
                        ) : null}
                        {!r.user.active ? <Badge tone="neutral">Inactive</Badge> : null}
                      </span>
                    </td>
                    <td className={`${tdClass} ${numClass} font-semibold`}>{formatHours(r.totalMs)}</td>
                    {target ? (
                      <td className={tdClass}>
                        <TargetBadge progress={targetProgress(r.totalMs, target)} />
                      </td>
                    ) : null}
                    <td className={`${tdClass} ${numClass} text-ink-2`}>
                      {r.meetingsAttended}
                      <span className="text-ink-3">/{report.meetingsHeld}</span>
                    </td>
                    <td className={`${tdClass} ${numClass}`}>
                      <span className="inline-flex items-center justify-end gap-2.5">
                        <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-accent-soft sm:block" aria-hidden>
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(r.attendancePct)}%` }} />
                        </span>
                        <span className="w-9">{Math.round(r.attendancePct)}%</span>
                      </span>
                    </td>
                    <td className={`${tdClass} ${numClass} whitespace-nowrap text-ink-2`}>
                      {r.lastSeen ? formatShortDate(r.lastSeen, tz) : <span className="text-ink-3">Never</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>
    </div>
  );
}

function Th({
  k,
  current,
  dir,
  href,
  right,
  children,
}: {
  k: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  href: string;
  right?: boolean;
  children: React.ReactNode;
}) {
  const active = current === k;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={`${thClass} ${right ? "text-right" : ""}`}>
      <Link
        href={href}
        className={`group inline-flex items-center gap-1 rounded-sm transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ring ${active ? "text-ink" : ""} ${right ? "flex-row-reverse" : ""}`}
      >
        {children}
        <Icon className={`size-3.5 ${active ? "text-accent-ink" : "text-ink-3/60 group-hover:text-ink-3"}`} aria-hidden />
      </Link>
    </th>
  );
}
