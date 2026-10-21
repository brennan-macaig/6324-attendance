import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarRange } from "lucide-react";
import { db } from "@/db";
import { getOpenMeeting } from "@/lib/attendance";
import { requirePageUser } from "@/lib/authz";
import { env } from "@/lib/env";
import { isMeetingType, MEETING_TYPES, meetingTypeInfo } from "@/lib/meeting-type";
import { listMeetings, resolveSeason } from "@/lib/queries";
import { runSweep } from "@/lib/sweep";
import { formatDate, formatTime } from "@/lib/time";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { buttonClass } from "@/components/button-class";
import {
  Badge,
  Card,
  EmptyState,
  Field,
  LiveDot,
  PageHeader,
  TableScroll,
  inputClass,
  labelClass,
  numClass,
  rowLinkClass,
  selectClass,
  tableClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";
import { closeMeetingAction, startMeetingAction } from "./actions";

export const metadata = { title: "Meetings" };

export default async function MeetingsPage({ searchParams }: PageProps<"/admin/meetings">) {
  await requirePageUser("mentor", "/admin/meetings");
  const sp = await searchParams;
  const tz = env.teamTimezone;
  await runSweep();
  const [{ seasons, season }, open] = await Promise.all([
    resolveSeason(db, typeof sp.season === "string" ? sp.season : null),
    getOpenMeeting(db),
  ]);
  const list = season ? await listMeetings(db, season.id) : [];
  const typeFilter = isMeetingType(sp.type) ? sp.type : null;
  const filteredList = typeFilter ? list.filter((row) => row.meeting.type === typeFilter) : list;
  const counts = { regular: 0, competition: 0, outreach: 0 } as Record<string, number>;
  for (const row of list) counts[row.meeting.type] += 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meetings"
        subtitle={season ? season.name : "No seasons yet"}
        actions={
          seasons.length ? (
            <form method="get" className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <label className="sr-only" htmlFor="season">
                  Season
                </label>
                <CalendarRange className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
                <AutoSubmitSelect id="season" name="season" defaultValue={season?.id} className={`${selectClass} w-60 pl-8`}>
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.isCurrent ? " (current)" : ""}
                    </option>
                  ))}
                </AutoSubmitSelect>
              </div>
              <label className="sr-only" htmlFor="type">
                Meeting type
              </label>
              <AutoSubmitSelect id="type" name="type" defaultValue={typeFilter ?? ""} className={`${selectClass} w-44`}>
                <option value="">All types</option>
                {MEETING_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </AutoSubmitSelect>
            </form>
          ) : null
        }
      />

      {open ? (
        <section className="flex flex-wrap items-center gap-4 rounded-card border border-success-line bg-success-soft px-5 py-4 shadow-card">
          <LiveDot className="size-2.5 [&>span]:size-2.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">A meeting is open</p>
            <p className="mt-0.5 text-sm text-ink-2">
              Started {formatDate(open.startsAt, tz)} at <span className="tabular">{formatTime(open.startsAt, tz)}</span>
              {open.notes ? ` · ${open.notes}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/kiosk" className={buttonClass("secondary", "md")}>
              Open kiosk
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <ActionForm action={closeMeetingAction} confirm="Close this meeting? Everyone still checked in will be checked out now." className="flex items-center gap-2">
              <input type="hidden" name="meetingId" value={open.id} />
              <SubmitButton variant="danger">Close meeting</SubmitButton>
            </ActionForm>
          </div>
        </section>
      ) : (
        <Card title="Start a meeting" description="Opens check-in for everyone. Show the kiosk on a screen so students can scan.">
          <ActionForm action={startMeetingAction} className="flex flex-wrap items-end gap-3">
            <Field label="Type" className="w-44">
              <select name="type" defaultValue="regular" className={selectClass}>
                {MEETING_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <label className="min-w-60 flex-1">
              <span className={labelClass}>Notes (optional)</span>
              <input name="notes" maxLength={500} className={`${inputClass} mt-1.5`} placeholder="e.g. Saturday build" />
            </label>
            <SubmitButton variant="primary">Start meeting now</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <Card
        flush
        title="All meetings"
        actions={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {MEETING_TYPES.map((t) => (
              <span key={t.id} className="tabular">
                {counts[t.id]} {t.label.toLowerCase()}
                {counts[t.id] === 1 ? "" : "s"}
              </span>
            ))}
          </span>
        }
      >
        {filteredList.length === 0 ? (
          <EmptyState icon={<CalendarDays />} title={typeFilter ? "No meetings of this type yet" : "No meetings in this season yet"}>
            {typeFilter ? "Try a different type, or clear the filter above." : "Start one above or from the kiosk."}
          </EmptyState>
        ) : (
          <TableScroll>
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th scope="col" className={thClass}>
                    Date
                  </th>
                  <th scope="col" className={thClass}>
                    Time
                  </th>
                  <th scope="col" className={thClass}>
                    Type
                  </th>
                  <th scope="col" className={thClass}>
                    Status
                  </th>
                  <th scope="col" className={`${thClass} ${numClass}`}>
                    Attendees
                  </th>
                  <th scope="col" className={`${thClass} w-full`}>
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(({ meeting: m, attendees, here }) => (
                  <tr key={m.id} className={trClass}>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <Link href={`/admin/meetings/${m.id}`} className={rowLinkClass}>
                        {formatDate(m.startsAt, tz)}
                      </Link>
                    </td>
                    <td className={`${tdClass} tabular whitespace-nowrap text-ink-2`}>
                      {formatTime(m.startsAt, tz)} – {m.endsAt ? formatTime(m.endsAt, tz) : "now"}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <Badge tone={meetingTypeInfo(m.type).tone}>{meetingTypeInfo(m.type).label}</Badge>
                    </td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {m.isOpen ? (
                        <Badge tone="success" icon={<span className="size-1.5 rounded-full bg-success" aria-hidden />}>
                          Open · {here} here
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Closed</Badge>
                      )}
                    </td>
                    <td className={`${tdClass} ${numClass} font-medium`}>{attendees}</td>
                    <td className={`${tdClass} max-w-xs truncate text-ink-2`}>{m.notes}</td>
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
