import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["student", "mentor", "admin"]);
export type Role = (typeof roleEnum.enumValues)[number];

const tsz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** Everyone who can sign in (students, mentors, admins). Roster == this table. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Always stored lower-cased. */
    email: text("email").notNull().unique(),
    name: text("name"),
    image: text("image"),
    role: roleEnum("role").notNull().default("student"),
    active: boolean("active").notNull().default(true),
    createdAt: tsz("created_at").notNull().defaultNow(),
    lastLoginAt: tsz("last_login_at"),
  },
  (t) => [index("users_role_active_idx").on(t.role, t.active)],
);

export const seasons = pgTable(
  "seasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    /** Minimum hours for the season (null = no target). */
    hoursTarget: numeric("hours_target", { precision: 6, scale: 1, mode: "number" }).default(80),
    /** Team-timezone date from which students see progress toward the target (null = from the start). */
    targetVisibleFrom: date("target_visible_from", { mode: "string" }),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  // At most one current season.
  (t) => [uniqueIndex("seasons_one_current_idx").on(t.isCurrent).where(sql`${t.isCurrent} = true`)],
);

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    startsAt: tsz("starts_at").notNull().defaultNow(),
    endsAt: tsz("ends_at"),
    isOpen: boolean("is_open").notNull().default(true),
    openedBy: uuid("opened_by").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: tsz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("meetings_season_starts_idx").on(t.seasonId, t.startsAt),
    // At most one open meeting at a time (keeps the kiosk + "current meeting" unambiguous).
    uniqueIndex("meetings_one_open_idx").on(t.isOpen).where(sql`${t.isOpen} = true`),
  ],
);

export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    checkedInAt: tsz("checked_in_at").notNull().defaultNow(),
    checkedOutAt: tsz("checked_out_at"),
    ip: text("ip"),
    deviceId: text("device_id"),
    flags: text("flags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    manualAdjustedBy: uuid("manual_adjusted_by").references(() => users.id, { onDelete: "set null" }),
    manualAdjustedAt: tsz("manual_adjusted_at"),
  },
  (t) => [
    unique("checkins_student_meeting_uq").on(t.studentId, t.meetingId),
    index("checkins_meeting_idx").on(t.meetingId),
    index("checkins_checked_in_at_idx").on(t.checkedInAt),
    index("checkins_meeting_device_idx").on(t.meetingId, t.deviceId),
  ],
);

export type User = typeof users.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type Checkin = typeof checkins.$inferSelect;
