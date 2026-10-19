import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { Users } from "lucide-react";
import { db } from "@/db";
import { roleEnum, users } from "@/db/schema";
import { requirePageUser } from "@/lib/authz";
import { env } from "@/lib/env";
import { displayName } from "@/lib/names";
import { formatShortDate } from "@/lib/time";
import { ActionForm, SubmitButton } from "@/components/action-form";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  Field,
  PageHeader,
  RoleBadge,
  TableScroll,
  inputClass,
  linkClass,
  rowLinkClass,
  selectClass,
  tableClass,
  tdClass,
  textareaClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";
import { addUserAction, bulkAddAction, deleteUserAction, updateUserAction } from "./actions";

export const metadata = { title: "Roster" };

export default async function RosterPage({ searchParams }: PageProps<"/admin/roster">) {
  const admin = await requirePageUser("admin", "/admin/roster");
  const sp = await searchParams;
  const showInactive = sp.inactive === "1";
  const tz = env.teamTimezone;
  const all = await db.select().from(users).orderBy(desc(users.active), asc(users.name), asc(users.email));
  const people = showInactive ? all : all.filter((u) => u.active);
  const inactiveCount = all.filter((u) => !u.active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roster"
        subtitle={
          <>
            {all.length - inactiveCount} active · {env.requireRoster ? "Only people on this list can sign in" : "Anyone allowed by domain is auto-added as a student on first sign-in"}
            {env.allowedEmailDomain ? ` · @${env.allowedEmailDomain} only` : ""}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Add one person">
          <ActionForm action={addUserAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" className="sm:col-span-2">
              <input name="email" type="email" required className={inputClass} placeholder={`student@${env.allowedEmailDomain ?? "school.org"}`} />
            </Field>
            <Field label="Full name" hint="Students are shown as first name + last initial.">
              <input name="name" className={inputClass} placeholder="Ada Park" />
            </Field>
            <Field label="Role">
              <select name="role" defaultValue="student" className={`${selectClass} capitalize`}>
                {roleEnum.enumValues.map((r) => (
                  <option key={r} value={r}>
                    {r[0].toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Add</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card title="Bulk add students" description="Paste emails, one per line, or “email, Full name”.">
          <ActionForm action={bulkAddAction} resetOnSuccess className="space-y-3">
            <label className="block">
              <span className="sr-only">Emails</span>
              <textarea
                name="text"
                required
                rows={5}
                className={`${textareaClass} font-mono text-[13px]`}
                placeholder={"ada@school.org\ngrace@school.org, Grace Hopper"}
              />
            </label>
            <SubmitButton>Add all</SubmitButton>
          </ActionForm>
        </Card>
      </div>

      <Card
        flush
        title="People"
        description="Emails are shown here for account management and may include last names."
        actions={
          <span className="flex items-center gap-3">
            <span className="tabular">{people.length} shown</span>
            {inactiveCount ? (
              <Link href={showInactive ? "/admin/roster" : "/admin/roster?inactive=1"} className={linkClass}>
                {showInactive ? "Hide" : "Show"} {inactiveCount} inactive
              </Link>
            ) : null}
          </span>
        }
      >
        {people.length === 0 ? (
          <EmptyState icon={<Users />} title="No one yet">
            Add people above, one at a time or in bulk.
          </EmptyState>
        ) : (
          <TableScroll>
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th scope="col" className={thClass}>
                    Person
                  </th>
                  <th scope="col" className={thClass}>
                    Name · role · status
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    Last sign-in
                  </th>
                  <th scope="col" className={thClass}>
                    <span className="sr-only">Delete</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {people.map((u) => {
                  const self = u.id === admin.id;
                  const isStudent = u.role === "student";
                  return (
                    <tr key={u.id} className={`${trClass} ${u.active ? "" : "bg-surface-2"}`}>
                      <td className={`${tdClass} min-w-64`}>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name || displayName(u)} image={u.image} size={32} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Link href={`/admin/students/${u.id}`} className={`${rowLinkClass} truncate`}>
                                {u.name ? displayName(u) : <span className="italic text-ink-3">No name</span>}
                              </Link>
                              <RoleBadge role={u.role} />
                              {!u.active ? <Badge tone="neutral">Inactive</Badge> : null}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-ink-3">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className={tdClass}>
                        <ActionForm action={updateUserAction} className="flex flex-wrap items-center gap-2" messageClassName="w-full text-xs">
                          <input type="hidden" name="userId" value={u.id} />
                          <label className="sr-only" htmlFor={`name-${u.id}`}>
                            {isStudent ? "Rename (blank keeps the current name)" : "Name"}
                          </label>
                          <input
                            id={`name-${u.id}`}
                            name="name"
                            // Student full names aren't pre-filled so last names stay hidden; blank keeps the current name.
                            defaultValue={isStudent ? "" : (u.name ?? "")}
                            placeholder={isStudent ? (u.name ? `Rename ${displayName(u)}…` : "Add full name…") : "Name"}
                            className={`${inputClass} h-8 w-44!`}
                          />
                          <label className="sr-only" htmlFor={`role-${u.id}`}>
                            Role
                          </label>
                          <select id={`role-${u.id}`} name="role" defaultValue={u.role} disabled={self} className={`${selectClass} h-8 w-28!`}>
                            {roleEnum.enumValues.map((r) => (
                              <option key={r} value={r}>
                                {r[0].toUpperCase() + r.slice(1)}
                              </option>
                            ))}
                          </select>
                          {self ? <input type="hidden" name="role" value={u.role} /> : null}
                          <label className="sr-only" htmlFor={`active-${u.id}`}>
                            Status
                          </label>
                          <select id={`active-${u.id}`} name="active" defaultValue={String(u.active)} disabled={self} className={`${selectClass} h-8 w-28!`}>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                          </select>
                          {self ? <input type="hidden" name="active" value="true" /> : null}
                          <SubmitButton size="sm" variant="secondary">
                            Save
                          </SubmitButton>
                        </ActionForm>
                      </td>
                      <td className={`${tdClass} tabular whitespace-nowrap text-right text-[13px] text-ink-2`}>
                        {u.lastLoginAt ? formatShortDate(u.lastLoginAt, tz) : <span className="text-ink-3">Never</span>}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        {!self ? (
                          <ActionForm action={deleteUserAction} confirm={`Permanently delete ${u.email}? (Only allowed if they have no attendance.)`} messageClassName="text-xs">
                            <input type="hidden" name="userId" value={u.id} />
                            <SubmitButton size="sm" variant="danger-soft">
                              Delete
                            </SubmitButton>
                          </ActionForm>
                        ) : (
                          <span className="text-xs text-ink-3">You</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>
    </div>
  );
}
