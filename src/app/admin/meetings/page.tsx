import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarRange } from "lucide-react";
import { db } from "@/db";
import { getOpenMeeting } from "@/lib/attendance";
import { requirePageUser } from "@/lib/authz";
import { env } from "@/lib/env";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meetings"
        subtitle={season ? season.name : "No seasons yet"}
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
                    {s.isCurrent ? " (current)" : ""}
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
            <label className="min-w-60 flex-1">
              <span className={labelClass}>Notes (optional)</span>
              <input name="notes" maxLength={500} className={`${inputClass} mt-1.5`} placeholder="e.g. Saturday build" />
            </label>
            <SubmitButton variant="primary">Start meeting now</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <Card flush title="All meetings" actions={<span className="tabular">{list.length} total</span>}>
        {list.length === 0 ? (
          <EmptyState icon={<CalendarDays />} title="No meetings in this season yet">
            Start one above or from the kiosk.
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
                {list.map(({ meeting: m, attendees, here }) => (
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
