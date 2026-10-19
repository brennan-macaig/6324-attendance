import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarRange, CalendarX2 } from "lucide-react";
import { z } from "zod";
import { db } from "@/db";
import { hasRole, requirePageUser } from "@/lib/authz";
import { env } from "@/lib/env";
import { attendancePct, checkinDurationMs, formatHours } from "@/lib/hours";
import { displayName } from "@/lib/names";
import { getUserById, resolveSeason, studentSeasonDetail, userNames } from "@/lib/queries";
import { fmt, targetProgress } from "@/lib/target";
import { formatDate, formatShortDate, formatTime } from "@/lib/time";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { AddCheckinControls, EditCheckinControls } from "@/components/checkin-edit";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  FlagBadges,
  PageHeader,
  RoleBadge,
  StatGrid,
  StatTile,
  StatusBadge,
  TableScroll,
  TargetProgressBar,
  numClass,
  rowLinkClass,
  selectClass,
  tableClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";

export const metadata = { title: "Student" };

export default async function StudentPage({ params, searchParams }: PageProps<"/admin/students/[id]">) {
  const { id } = await params;
  const viewer = await requirePageUser("mentor", `/admin/students/${id}`);
  const isAdmin = hasRole(viewer, "admin");
  if (!z.uuid().safeParse(id).success) notFound();
  const student = await getUserById(db, id);
  if (!student) notFound();
  const sp = await searchParams;
  const tz = env.teamTimezone;
  const cutoff = env.dailyCutoff;
  const { seasons, season } = await resolveSeason(db, typeof sp.season === "string" ? sp.season : null);
  const detail = season ? await studentSeasonDetail(db, student.id, season.id) : [];
  const now = new Date();
  const held = detail.filter((d) => d.meeting.startsAt <= now).length;
  const attended = detail.filter((d) => d.checkin);
  const totalMs = attended.reduce((s, d) => s + checkinDurationMs(d.checkin!.checkedInAt, d.checkin!.checkedOutAt, cutoff), 0);
  const adjusters = await userNames(db, attended.map((d) => d.checkin!.manualAdjustedBy ?? ""));
  const name = displayName(student);
  const progress = targetProgress(totalMs, season?.hoursTarget);
  const isStudent = student.role === "student";

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: `/admin/hours${season ? `?season=${season.id}` : ""}`, label: "Season hours" }}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={student.name || name} image={student.image} size={40} />
            {name}
          </span>
        }
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <RoleBadge role={student.role} />
            {!student.active ? <Badge tone="neutral">Inactive</Badge> : null}
            {/* Student emails often contain last names; only shown on the roster page. */}
            {!isStudent ? <span className="text-ink-3">{student.email}</span> : null}
          </span>
        }
        actions={
          seasons.length ? (
            <form method="get" className="relative">
              <label className="sr-only" htmlFor="season">
                Season
              </label>
              <CalendarRange className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <AutoSubmitSelect id="season" name="season" defaultValue={season?.id} className={`${selectClass} w-60 pl-8`}>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </AutoSubmitSelect>
            </form>
          ) : null
        }
      />

      <StatGrid>
        <StatTile label="Hours" value={formatHours(totalMs)} hint={progress ? (progress.met ? "Minimum met" : `${fmt(progress.remaining)} to go`) : undefined} />
        <StatTile label="Meetings attended" value={attended.length} hint={`of ${held} held`} />
        <StatTile label="Attendance" value={`${Math.round(attendancePct(attended.length, held))}%`} />
        <StatTile label="Last seen" value={attended[0] ? formatShortDate(attended[0].checkin!.checkedInAt, tz) : "Never"} />
      </StatGrid>

      {progress ? (
        <Card title="Season minimum">
          <TargetProgressBar progress={progress} />
          {season?.targetVisibleFrom ? (
            <p className="mt-3 text-xs text-ink-3">
              Students see their progress from {formatDate(new Date(`${season.targetVisibleFrom}T12:00:00Z`), "UTC")}.
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card flush title="Per-meeting breakdown" actions={isAdmin ? null : <span>Read-only (admins can edit)</span>}>
        {detail.length === 0 ? (
          <EmptyState icon={<CalendarX2 />} title="No meetings in this season" />
        ) : (
          <TableScroll>
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th scope="col" className={thClass}>
                    Meeting
                  </th>
                  <th scope="col" className={`${thClass} ${numClass}`}>
                    In
                  </th>
                  <th scope="col" className={`${thClass} ${numClass}`}>
                    Out
                  </th>
                  <th scope="col" className={`${thClass} ${numClass}`}>
                    Hours
                  </th>
                  <th scope="col" className={`${thClass} w-full`}>
                    Flags
                  </th>
                  {isAdmin ? (
                    <th scope="col" className={thClass}>
                      <span className="sr-only">Edit</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {detail.map(({ meeting: m, checkin: c }) => (
                  <tr key={m.id} className={`${trClass} align-top`}>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <Link href={`/admin/meetings/${m.id}`} className={`${rowLinkClass} ${c ? "" : "text-ink-2"}`}>
                        {formatDate(m.startsAt, tz)}
                      </Link>
                      {m.isOpen ? (
                        <span className="ml-2">
                          <Badge tone="success">Open</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td className={`${tdClass} ${numClass} whitespace-nowrap text-ink-2`} title={c?.ip ? `IP ${c.ip}` : undefined}>
                      {c ? formatTime(c.checkedInAt, tz) : <StatusBadge kind="absent" />}
                    </td>
                    <td className={`${tdClass} ${numClass} whitespace-nowrap text-ink-2`}>
                      {c ? c.checkedOutAt ? formatTime(c.checkedOutAt, tz) : <Badge tone="success">Here now</Badge> : null}
                    </td>
                    <td className={`${tdClass} ${numClass} font-medium`}>{c?.checkedOutAt ? formatHours(checkinDurationMs(c.checkedInAt, c.checkedOutAt, cutoff), 2) : c ? <span className="text-ink-3">—</span> : null}</td>
                    <td className={tdClass}>
                      {c ? <FlagBadges short flags={c.flags} /> : null}
                      {c?.manualAdjustedBy ? (
                        <div className="mt-1 text-xs text-ink-3">
                          Adjusted by {adjusters.get(c.manualAdjustedBy) ?? "unknown"}
                          {c.manualAdjustedAt ? ` on ${formatShortDate(c.manualAdjustedAt, tz)}` : ""}
                        </div>
                      ) : null}
                    </td>
                    {isAdmin ? (
                      <td className={`${tdClass} text-right`}>
                        {c ? <EditCheckinControls checkin={c} tz={tz} /> : <AddCheckinControls studentId={student.id} meeting={m} tz={tz} />}
                      </td>
                    ) : null}
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
