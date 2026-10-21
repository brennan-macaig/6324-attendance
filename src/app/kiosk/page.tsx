import { QrCode } from "lucide-react";
import { db } from "@/db";
import { getOpenMeeting } from "@/lib/attendance";
import { requirePageUser } from "@/lib/authz";
import { formatCutoff, isPastCutoff } from "@/lib/cutoff";
import { env } from "@/lib/env";
import { MEETING_TYPES, meetingTypeInfo } from "@/lib/meeting-type";
import { getCurrentSeason } from "@/lib/queries";
import { runSweep } from "@/lib/sweep";
import { formatTime } from "@/lib/time";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { inputClass, labelClass, selectClass } from "@/components/ui";
import { closeMeetingAction, startMeetingAction } from "../admin/meetings/actions";
import { KioskClient } from "./kiosk-client";

export const metadata = { title: "Kiosk" };

/** Full-bleed navy frame that breaks out of the page container. */
function Bleed({ children }: { children: React.ReactNode }) {
  return <div className="relative left-1/2 -mb-16 -mt-6 w-screen -translate-x-1/2 bg-header sm:-mt-10">{children}</div>;
}

export default async function KioskPage() {
  await requirePageUser("mentor", "/kiosk");
  await runSweep();
  const [meeting, season] = await Promise.all([getOpenMeeting(db), getCurrentSeason(db)]);
  const cutoff = env.dailyCutoff;

  if (!meeting) {
    const closedForToday = isPastCutoff(new Date(), cutoff);
    return (
      <Bleed>
        <div className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden px-4 py-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_30rem_at_50%_-10%,rgb(63_111_230/0.3),transparent_65%)]"
          />
          <div className="animate-fade-in-up relative w-full max-w-md rounded-panel border border-line bg-surface p-6 text-ink shadow-pop sm:p-8">
            <div className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink ring-1 ring-inset ring-brand-200 dark:ring-brand-800">
              <QrCode className="size-6" aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">No meeting is open</h1>
            {!season ? (
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">There&apos;s no current season. An admin needs to create one on the Seasons page.</p>
            ) : closedForToday ? (
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                Check-in closes at {formatCutoff(cutoff)} each day. You can start the next meeting tomorrow.
              </p>
            ) : (
              <>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                  Start a meeting to show the check-in QR code on this screen. Season: <span className="font-medium text-ink">{season.name}</span>
                </p>
                <ActionForm action={startMeetingAction} className="mt-6 space-y-4">
                  <input type="hidden" name="goToKiosk" value="1" />
                  <label className="block">
                    <span className={labelClass}>Type</span>
                    <select name="type" defaultValue="regular" className={`${selectClass} mt-1.5 h-11 text-[15px]`}>
                      {MEETING_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClass}>Notes (optional)</span>
                    <input name="notes" maxLength={500} placeholder="e.g. Build session" className={`${inputClass} mt-1.5 h-11 text-[15px]`} />
                  </label>
                  <SubmitButton size="xl" variant="primary">
                    Start meeting
                  </SubmitButton>
                </ActionForm>
              </>
            )}
          </div>
        </div>
      </Bleed>
    );
  }

  return (
    <Bleed>
      <KioskClient meetingId={meeting.id} teamName={env.teamName} timeZone={env.teamTimezone} />
      <div className="border-t border-white/10 bg-[#081830]">
        <div className="flex min-h-[4.5rem] flex-wrap items-center justify-between gap-4 px-6 py-3 md:px-10">
          <p className="text-sm text-header-ink">
            Meeting started <span className="tabular font-medium text-white">{formatTime(meeting.startsAt, env.teamTimezone)}</span>
            {meeting.type !== "regular" ? <span className="text-header-ink/80"> · {meetingTypeInfo(meeting.type).label}</span> : null}
            {meeting.notes ? <span className="text-header-ink/80"> · {meeting.notes}</span> : null}
            <span className="text-header-ink/60"> · Auto check-out at {formatCutoff(cutoff)}</span>
          </p>
          <ActionForm
            action={closeMeetingAction}
            confirm="Close this meeting? Everyone still checked in will be checked out now."
            className="flex items-center gap-3 [&>p]:text-header-ink"
          >
            <input type="hidden" name="meetingId" value={meeting.id} />
            <SubmitButton variant="danger">Close meeting</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </Bleed>
  );
}
