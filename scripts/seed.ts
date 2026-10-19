/**
 * Demo data: npm run db:seed [-- --force]
 *
 * Applies migrations, then creates a current season, a roster, ~6 weeks of
 * past meetings with realistic check-ins/flags, and an OPEN meeting today so
 * the dashboard and kiosk have something to show.
 *
 * Works with Neon / any Postgres (TCP via `postgres`) or `pglite://<dir>`.
 * Refuses to run on a non-empty database unless --force (which TRUNCATES).
 */
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import type { AnyDb } from "../src/db/types";
import { addDays, isoDateInTz, zonedWallTimeToUtc } from "../src/lib/time";

config({ path: [".env.local", ".env"], quiet: true });

const force = process.argv.includes("--force");
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const tz = process.env.TEAM_TIMEZONE || "America/New_York";

async function connect(): Promise<{ db: AnyDb; close: () => Promise<void> }> {
  if (!url) throw new Error("Set DATABASE_URL (in .env.local) first");
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = url.replace(/^pglite:\/\//, "") || ".data/pglite";
    (await import("node:fs")).mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    const db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder: "drizzle" });
    return { db: db as unknown as AnyDb, close: () => client.close() };
  }
  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db: db as unknown as AnyDb, close: () => client.end() };
}

// Deterministic PRNG so the demo looks the same every time.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);
const between = (a: number, b: number) => a + rand() * (b - a);
const MIN = 60_000;

const STUDENTS: string[] = [
  "Ada Park",
  "Ben Ortiz",
  "Chloe Nguyen",
  "Dev Patel",
  "Elena Rossi",
  "Felix Wong",
  "Grace Kim",
  "Hugo Silva",
  "Isla Brown",
  "Jamal Carter",
  "Kira Ivanova",
  "Leo Martin",
  "Maya Cohen",
  "Noah Smith",
  "Olivia Davis",
  "Priya Shah",
  "Quinn Murphy",
  "Ravi Kumar",
];

async function main() {
  const { db, close } = await connect();
  try {
    const existing = await db.select({ id: schema.seasons.id }).from(schema.seasons).limit(1);
    if (existing.length && !force) {
      console.error("Database already has data. Re-run with --force to TRUNCATE all tables and reseed.");
      process.exitCode = 1;
      return;
    }
    if (force) {
      await db.execute(sql`TRUNCATE checkins, meetings, seasons, users RESTART IDENTITY CASCADE`);
    }

    const now = new Date();
    const today = isoDateInTz(now, tz);
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const startYear = month >= 8 ? year : year - 1;

    const [season] = await db
      .insert(schema.seasons)
      .values({
        name: `${startYear}–${String(startYear + 1).slice(2)} season`,
        startDate: `${startYear}-08-01`,
        endDate: `${startYear + 1}-07-31`,
        isCurrent: true,
        // 80-hour minimum; students see progress from Jan 9 of the season's spring.
        hoursTarget: 80,
        targetVisibleFrom: `${startYear + 1}-01-09`,
      })
      .returning();

    const adminEmails = (process.env.ADMIN_EMAILS || "admin@example.org").split(/[\s,]+/).filter(Boolean);
    const domain = process.env.ALLOWED_EMAIL_DOMAIN || "example.org";
    const slug = (n: string) => n.toLowerCase().replace(/[^a-z]+/g, ".");

    const people = await db
      .insert(schema.users)
      .values([
        ...adminEmails.map((e) => ({ email: e.toLowerCase(), role: "admin" as const })),
        { email: `coach.lee@${domain}`, name: "Coach Lee", role: "mentor" as const },
        { email: `ms.garcia@${domain}`, name: "Ms. Garcia", role: "mentor" as const },
        ...STUDENTS.map((name) => ({ email: `${slug(name)}@${domain}`, name })),
        { email: `former.student@${domain}`, name: "Former Student", active: false },
      ])
      .returning();
    const mentor = people.find((p) => p.role === "mentor")!;
    const admin = people.find((p) => p.role === "admin")!;
    const students = people.filter((p) => p.role === "student" && p.active);
    const reliability = new Map(students.map((s) => [s.id, between(0.45, 0.97)]));

    // Past meetings: Tue/Thu 6-9pm, Sat 10am-3pm, for the last 6 weeks.
    const meetingRows: { date: string; startH: number; endH: number }[] = [];
    for (let d = -42; d <= -1; d++) {
      const date = addDays(today, d);
      const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
      if (dow === 2 || dow === 4) meetingRows.push({ date, startH: 18, endH: 21 });
      if (dow === 6) meetingRows.push({ date, startH: 10, endH: 15 });
    }
    const at = (date: string, h: number) => {
      const [y, m, dd] = date.split("-").map(Number);
      return zonedWallTimeToUtc(y, m, dd, h, 0, tz);
    };

    let checkinCount = 0;
    for (const [i, mr] of meetingRows.entries()) {
      const startsAt = at(mr.date, mr.startH);
      const endsAt = at(mr.date, mr.endH);
      const [meeting] = await db
        .insert(schema.meetings)
        .values({ seasonId: season.id, startsAt, endsAt, isOpen: false, openedBy: mentor.id, notes: mr.startH === 10 ? "Saturday build" : null })
        .returning();
      const rows: (typeof schema.checkins.$inferInsert)[] = [];
      for (const s of students) {
        if (rand() > reliability.get(s.id)!) continue;
        const inAt = new Date(startsAt.getTime() + between(-5, 35) * MIN);
        const flags: string[] = [];
        let outAt: Date;
        const r = rand();
        if (r < 0.1) {
          // Forgot to check out: weekday meetings end at the 9 PM daily cutoff.
          outAt = endsAt;
          flags.push(mr.endH >= 21 ? "auto_checkout_9pm" : "auto_checkout");
        } else {
          outAt = new Date(endsAt.getTime() - between(0, 60) * MIN);
        }
        if (rand() < 0.05) flags.push("off_network");
        rows.push({
          studentId: s.id,
          meetingId: meeting.id,
          checkedInAt: inAt,
          checkedOutAt: outAt,
          ip: flags.includes("off_network") ? "203.0.113.50" : "10.20.30.40",
          deviceId: `seed-device-${s.id.slice(0, 8)}`,
          flags,
        });
      }
      // One shared-device incident and one manual fix, for the demo.
      if (i === 3 && rows.length >= 2) {
        rows[1].deviceId = rows[0].deviceId;
        rows[0].flags = [...(rows[0].flags ?? []), "shared_device"];
        rows[1].flags = [...(rows[1].flags ?? []), "shared_device"];
      }
      if (i === 5 && rows.length) {
        rows[0].flags = ["manual"];
        rows[0].manualAdjustedBy = admin.id;
        rows[0].manualAdjustedAt = endsAt;
        rows[0].ip = null;
        rows[0].deviceId = null;
      }
      if (rows.length) await db.insert(schema.checkins).values(rows);
      checkinCount += rows.length;
    }

    // Today's open meeting, started 90 minutes ago.
    const openStart = new Date(now.getTime() - 90 * MIN);
    const [open] = await db
      .insert(schema.meetings)
      .values({ seasonId: season.id, startsAt: openStart, isOpen: true, openedBy: mentor.id, notes: "Demo: open meeting" })
      .returning();
    const todayRows = students
      .filter(() => rand() < 0.65)
      .map((s, idx) => ({
        studentId: s.id,
        meetingId: open.id,
        checkedInAt: new Date(openStart.getTime() + between(0, 60) * MIN),
        checkedOutAt: idx % 5 === 4 ? new Date(now.getTime() - between(1, 15) * MIN) : null,
        ip: "10.20.30.40",
        deviceId: `seed-device-${s.id.slice(0, 8)}`,
        flags: [] as string[],
      }));
    if (todayRows.length) await db.insert(schema.checkins).values(todayRows);

    console.log(
      `Seeded: season "${season.name}", ${people.length} people (admins: ${adminEmails.join(", ")}), ` +
        `${meetingRows.length} past meetings with ${checkinCount} check-ins, and 1 open meeting with ${todayRows.length} check-ins.`,
    );
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
