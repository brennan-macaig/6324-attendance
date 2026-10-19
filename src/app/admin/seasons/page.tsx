import { CalendarRange, CircleCheck } from "lucide-react";
import { db } from "@/db";
import { requirePageUser } from "@/lib/authz";
import { listSeasons } from "@/lib/queries";
import { formatDate } from "@/lib/time";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, EmptyState, Field, PageHeader, inputClass } from "@/components/ui";
import { createSeasonAction, deleteSeasonAction, setCurrentSeasonAction, updateSeasonAction } from "./actions";

export const metadata = { title: "Seasons" };

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`), "UTC");

export default async function SeasonsPage() {
  await requirePageUser("admin", "/admin/seasons");
  const seasons = await listSeasons(db);
  const year = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <PageHeader title="Seasons" subtitle="New meetings attach to the current season. Each season can have a minimum-hours target." />

      <Card title="New season">
        <ActionForm action={createSeasonAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
          <Field label="Name">
            <input name="name" required maxLength={80} placeholder={`${year}–${year + 1}`} className={inputClass} />
          </Field>
          <Field label="Start date">
            <input type="date" name="startDate" required className={inputClass} />
          </Field>
          <Field label="End date">
            <input type="date" name="endDate" required className={inputClass} />
          </Field>
          <Field label="Hours target">
            <input type="number" name="hoursTarget" min={0.5} step={0.5} defaultValue={80} className={`${inputClass} tabular`} />
          </Field>
          <Field label="Show progress from">
            <input type="date" name="targetVisibleFrom" className={inputClass} />
          </Field>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-5">
            <label className="inline-flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" name="makeCurrent" defaultChecked={seasons.length === 0} className="size-4 rounded accent-[var(--accent)]" /> Make current
            </label>
            <SubmitButton>Create season</SubmitButton>
            <p className="text-xs text-ink-3">Leave the target blank for no minimum, or the date blank to show students their progress right away.</p>
          </div>
        </ActionForm>
      </Card>

      {seasons.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarRange />} title="No seasons yet">
            Create your first season above.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {seasons.map((s) => (
            <Card
              key={s.id}
              title={
                <span className="flex items-center gap-2">
                  {s.name}
                  {s.isCurrent ? (
                    <Badge tone="success" icon={<CircleCheck className="size-3" aria-hidden />}>
                      Current
                    </Badge>
                  ) : null}
                </span>
              }
              description={
                <>
                  {day(s.startDate)} – {day(s.endDate)}
                  {s.hoursTarget ? ` · ${s.hoursTarget}-hour minimum` : " · No minimum"}
                  {s.hoursTarget && s.targetVisibleFrom ? `, shown to students from ${day(s.targetVisibleFrom)}` : ""}
                </>
              }
              actions={
                <div className="flex items-center gap-2">
                  {!s.isCurrent ? (
                    <ActionForm action={setCurrentSeasonAction} messageClassName="text-xs">
                      <input type="hidden" name="seasonId" value={s.id} />
                      <SubmitButton size="sm" variant="secondary">
                        Make current
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                  <ActionForm action={deleteSeasonAction} confirm={`Delete ${s.name}? Only allowed if it has no meetings.`} messageClassName="text-xs">
                    <input type="hidden" name="seasonId" value={s.id} />
                    <SubmitButton size="sm" variant="danger-soft">
                      Delete
                    </SubmitButton>
                  </ActionForm>
                </div>
              }
            >
              <ActionForm action={updateSeasonAction} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end">
                <input type="hidden" name="seasonId" value={s.id} />
                <Field label="Name">
                  <input name="name" required maxLength={80} defaultValue={s.name} className={inputClass} />
                </Field>
                <Field label="Start date">
                  <input type="date" name="startDate" required defaultValue={s.startDate} className={inputClass} />
                </Field>
                <Field label="End date">
                  <input type="date" name="endDate" required defaultValue={s.endDate} className={inputClass} />
                </Field>
                <Field label="Hours target">
                  <input type="number" name="hoursTarget" min={0.5} step={0.5} defaultValue={s.hoursTarget ?? ""} placeholder="None" className={`${inputClass} tabular`} />
                </Field>
                <Field label="Show progress from">
                  <input type="date" name="targetVisibleFrom" defaultValue={s.targetVisibleFrom ?? ""} className={inputClass} />
                </Field>
                <div>
                  <SubmitButton size="md" variant="secondary">
                    Save
                  </SubmitButton>
                </div>
              </ActionForm>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
