import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, UserPlus, Users } from "lucide-react";
import { z } from "zod";
import { db } from "@/db";
import { getMeeting } from "@/lib/attendance";
import { hasRole, requirePageUser } from "@/lib/authz";
import { env } from "@/lib/env";
import { checkinDurationMs, elapsedMs, formatDuration, formatHours } from "@/lib/hours";
import { displayName } from "@/lib/names";
import { MEETING_TYPES, meetingTypeInfo } from "@/lib/meeting-type";
import { activeRoster, getSeason, meetingAttendees, userNames } from "@/lib/queries";
import { formatDate, formatTime, toDateTimeLocalValue } from "@/lib/time";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { buttonClass } from "@/components/button-class";
import { EditCheckinControls } from "@/components/checkin-edit";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  Field,
  FlagBadges,
  PageHeader,
  StatGrid,
  StatTile,
  TableScroll,
  inputClass,
  numClass,
  rowLinkClass,
  selectClass,
  tableClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";
import { addCheckinAction } from "../../checkin-actions";
import { closeMeetingAction, deleteMeetingAction, updateMeetingAction } from "../actions";

export const metadata = { title: "Meeting" };

export default async function MeetingPage({ params }: PageProps<"/admin/meetings/[id]">) {
  const { id } = await params;
  const viewer = await requirePageUser("mentor", `/admin/meetings/${id}`);
  const isAdmin = hasRole(viewer, "admin");
  if (!z.uuid().safeParse(id).success) notFound();
  const meeting = await getMeeting(db, id);
  if (!meeting) notFound();
  const tz = env.teamTimezone;
  const cutoff = env.dailyCutoff;
  const now = new Date();
  const [season, attendees, roster] = await Promise.all([
    getSeason(db, meeting.seasonId),
    meetingAttendees(db, meeting.id),
    isAdmin ? activeRoster(db, ["student", "mentor", "admin"]) : Promise.resolve([]),
  ]);
  const names = await userNames(db, [meeting.openedBy ?? "", ...attendees.map((a) => a.checkin.manualAdjustedBy ?? "")]);
  const present = new Set(attendees.map((a) => a.user.id));
  const notPresent = roster.filter((r) => !present.has(r.id)).sort((a, b) => displayName(a).localeCompare(displayName(b)));
  const totalMs = attendees.reduce((s, a) => s + checkinDurationMs(a.checkin.checkedInAt, a.checkin.checkedOutAt, cutoff), 0);
  const flagged = attendees.filter((a) => a.checkin.flags.some((f) => f === "shared_device" || f === "off_network")).length;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: `/admin/meetings?season=${meeting.seasonId}`, label: "All meetings" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {formatDate(meeting.startsAt, tz)}
            {meeting.isOpen ? (
              <Badge tone="success" icon={<span className="size-1.5 rounded-full bg-success" aria-hidden />}>
                Open
              </Badge>
            ) : (
              <Badge tone="neutral">Closed</Badge>
            )}
            <Badge tone={meetingTypeInfo(meeting.type).tone}>{meetingTypeInfo(meeting.type).label}</Badge>
          </span>
        }
        subtitle={
          <>
            <span className="tabular">
              {formatTime(meeting.startsAt, tz)} – {meeting.endsAt ? formatTime(meeting.endsAt, tz) : "now"}
            </span>
            {season ? ` · ${season.name}` : ""} · opened by {meeting.openedBy ? (names.get(meeting.openedBy) ?? "unknown") : "unknown"}
          </>
        }
        actions={
          meeting.isOpen ? (
            <>
              <Link href="/kiosk" className={buttonClass("secondary", "md")}>
                Kiosk
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <ActionForm action={closeMeetingAction} confirm="Close this meeting? Everyone still checked in will be checked out now.">
                <input type="hidden" name="meetingId" value={meeting.id} />
                <SubmitButton variant="danger">Close meeting</SubmitButton>
              </ActionForm>
            </>
          ) : null
        }
      />

      <StatGrid>
        <StatTile label="Attendees" value={attendees.length} />
        <StatTile label="Still here" value={attendees.filter((a) => !a.checkin.checkedOutAt).length} indicator={meeting.isOpen ? "live" : undefined} />
        <StatTile label="Total hours" value={formatHours(totalMs)} />
        <StatTile label="Flagged check-ins" value={flagged} hint="Off network or shared device" indicator={flagged ? "warning" : undefined} />
      </StatGrid>

      <Card flush title="Attendees" actions={<span className="tabular">{attendees.length} people</span>}>
        {attendees.length === 0 ? (
          <EmptyState icon={<Users />} title="No one checked in" />
        ) : (
          <TableScroll>
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th scope="col" className={thClass}>
                    Name
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
                  {isAdmin ? (
                    <th scope="col" className={thClass}>
                      <span className="sr-only">Edit</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {attendees.map(({ user: u, checkin: c }) => (
                  <tr key={c.id} className={trClass}>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <Link href={`/admin/students/${u.id}?season=${meeting.seasonId}`} className={`flex items-center gap-2.5 ${rowLinkClass}`}>
                        <Avatar name={displayName(u)} image={u.image} size={26} />
                        {displayName(u)}
                      </Link>
                    </td>
                    <td className={`${tdClass} ${numClass} whitespace-nowrap text-ink-2`} title={c.ip ? `IP ${c.ip}` : undefined}>
                      {formatTime(c.checkedInAt, tz)}
                    </td>
                    <td className={`${tdClass} ${numClass} whitespace-nowrap text-ink-2`}>
                      {c.checkedOutAt ? formatTime(c.checkedOutAt, tz) : <Badge tone="success">Here</Badge>}
                    </td>
                    <td className={`${tdClass} ${numClass} whitespace-nowrap font-medium`}>
                      {c.checkedOutAt ? `${formatHours(checkinDurationMs(c.checkedInAt, c.checkedOutAt, cutoff), 2)}h` : formatDuration(elapsedMs(c.checkedInAt, now))}
                    </td>
                    <td className={tdClass}>
                      <FlagBadges short flags={c.flags} />
                      {c.manualAdjustedBy ? <div className="mt-1 text-xs text-ink-3">Adjusted by {names.get(c.manualAdjustedBy) ?? "unknown"}</div> : null}
                    </td>
                    {isAdmin ? (
                      <td className={`${tdClass} text-right`}>
                        <EditCheckinControls checkin={c} tz={tz} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>

      <div className={`grid gap-4 ${isAdmin ? "lg:grid-cols-2" : ""}`}>
        {isAdmin ? (
          <Card title="Add a check-in manually" description="For someone who forgot to scan. Marked as manual.">
            {notPresent.length === 0 ? (
              <EmptyState icon={<UserPlus />}>Everyone on the roster has a check-in for this meeting.</EmptyState>
            ) : (
              <ActionForm action={addCheckinAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="meetingId" value={meeting.id} />
                <Field label="Person" className="sm:col-span-2">
                  <select name="studentId" required className={selectClass} defaultValue="">
                    <option value="" disabled>
                      Choose…
                    </option>
                    {notPresent.map((p) => (
                      <option key={p.id} value={p.id}>
                        {displayName(p)}
                        {p.role !== "student" ? ` (${p.role})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="In">
                  <input type="datetime-local" name="checkedInAt" required defaultValue={toDateTimeLocalValue(meeting.startsAt, tz)} className={inputClass} />
                </Field>
                <Field label="Out">
                  <input type="datetime-local" name="checkedOutAt" defaultValue={toDateTimeLocalValue(meeting.endsAt, tz)} className={inputClass} />
                </Field>
                <div className="sm:col-span-2">
                  <SubmitButton>Add check-in</SubmitButton>
                </div>
              </ActionForm>
            )}
          </Card>
        ) : null}

        <Card title="Meeting details">
          <ActionForm action={updateMeetingAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="meetingId" value={meeting.id} />
            {isAdmin ? (
              <>
                <Field label="Starts">
                  <input type="datetime-local" name="startsAt" required defaultValue={toDateTimeLocalValue(meeting.startsAt, tz)} className={inputClass} />
                </Field>
                <Field label={`Ends${meeting.isOpen ? " (blank while open)" : ""}`}>
                  <input type="datetime-local" name="endsAt" defaultValue={toDateTimeLocalValue(meeting.endsAt, tz)} className={inputClass} />
                </Field>
              </>
            ) : null}
            <Field label="Type">
              <select name="type" defaultValue={meeting.type} className={selectClass}>
                {MEETING_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes" className={isAdmin ? "sm:col-span-2" : ""}>
              <input name="notes" maxLength={500} defaultValue={meeting.notes ?? ""} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Save</SubmitButton>
            </div>
          </ActionForm>
          {isAdmin ? (
            <ActionForm
              action={deleteMeetingAction}
              confirm="Delete this meeting and ALL its check-ins? This cannot be undone."
              className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
            >
              <input type="hidden" name="meetingId" value={meeting.id} />
              <p className="text-[13px] text-ink-3">Deletes the meeting and all of its check-ins.</p>
              <SubmitButton variant="danger-soft" size="sm">
                Delete meeting
              </SubmitButton>
            </ActionForm>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
