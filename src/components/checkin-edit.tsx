import { Pencil, Plus } from "lucide-react";
import { ActionForm, SubmitButton } from "./action-form";
import { inputClass, labelClass } from "./ui";
import { addCheckinAction, deleteCheckinAction, editCheckinAction } from "@/app/admin/checkin-actions";
import { toDateTimeLocalValue } from "@/lib/time";

const summaryClass =
  "inline-flex h-7 cursor-pointer select-none items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-accent-ink transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-ring group-open:bg-accent-soft";
const panelClass = "animate-pop-in ml-auto mt-2 w-[min(17rem,80vw)] space-y-3 rounded-card border border-line bg-surface-2 p-3 text-left shadow-xs";

/** Admin-only inline editor for an existing check-in. */
export function EditCheckinControls({
  checkin,
  tz,
}: {
  checkin: { id: string; checkedInAt: Date; checkedOutAt: Date | null };
  tz: string;
}) {
  return (
    <details className="group">
      <summary className={summaryClass}>
        <Pencil className="size-3.5" aria-hidden />
        Edit
      </summary>
      <div className={panelClass}>
        <ActionForm action={editCheckinAction} className="grid gap-2.5">
          <input type="hidden" name="checkinId" value={checkin.id} />
          <label className="block">
            <span className={labelClass}>In</span>
            <input type="datetime-local" name="checkedInAt" required defaultValue={toDateTimeLocalValue(checkin.checkedInAt, tz)} className={`${inputClass} mt-1`} />
          </label>
          <label className="block">
            <span className={labelClass}>Out (blank = still here)</span>
            <input type="datetime-local" name="checkedOutAt" defaultValue={toDateTimeLocalValue(checkin.checkedOutAt, tz)} className={`${inputClass} mt-1`} />
          </label>
          <div>
            <SubmitButton size="sm">Save</SubmitButton>
          </div>
        </ActionForm>
        <ActionForm
          action={deleteCheckinAction}
          confirm="Delete this check-in? Their hours for this meeting will be removed."
          className="border-t border-line pt-3"
        >
          <input type="hidden" name="checkinId" value={checkin.id} />
          <SubmitButton size="sm" variant="danger-soft">
            Delete check-in
          </SubmitButton>
        </ActionForm>
      </div>
    </details>
  );
}

/** Admin-only: add a manual check-in for a known student + meeting. */
export function AddCheckinControls({
  studentId,
  meeting,
  tz,
}: {
  studentId: string;
  meeting: { id: string; startsAt: Date; endsAt: Date | null };
  tz: string;
}) {
  return (
    <details className="group">
      <summary className={summaryClass}>
        <Plus className="size-3.5" aria-hidden />
        Add
      </summary>
      <ActionForm action={addCheckinAction} className={`${panelClass} grid gap-2.5 space-y-0`}>
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="meetingId" value={meeting.id} />
        <label className="block">
          <span className={labelClass}>In</span>
          <input type="datetime-local" name="checkedInAt" required defaultValue={toDateTimeLocalValue(meeting.startsAt, tz)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block">
          <span className={labelClass}>Out</span>
          <input type="datetime-local" name="checkedOutAt" defaultValue={toDateTimeLocalValue(meeting.endsAt, tz)} className={`${inputClass} mt-1`} />
        </label>
        <div>
          <SubmitButton size="sm">Add check-in</SubmitButton>
        </div>
      </ActionForm>
    </details>
  );
}
