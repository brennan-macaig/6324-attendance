# FRC Attendance & Hours

Attendance and hours tracking for an FRC robotics team. Students sign in with Google
and check in by scanning a **rotating QR code** shown on a kiosk screen. Mentors see who's here
in real time, admins manage the roster, seasons, and meetings, and can fix anyone's hours.

Built to run for free on **Vercel Hobby** + **Neon Postgres (free tier)**: serverless
functions only, no WebSockets, no local filesystem, configured entirely by environment variables.

- Next.js 16 (App Router, TypeScript, Tailwind CSS 4)
- Auth.js / next-auth v5 (Google provider, JWT sessions)
- Drizzle ORM + `@neondatabase/serverless` (HTTP driver), drizzle-kit migrations
- `qrcode` for QR rendering (server-side SVG), `zod` for all input validation, SWR for kiosk polling
- Vitest unit tests + PGlite (in-process Postgres) integration tests

---

## Architecture

```
src/
  app/
    page.tsx                  Landing: Google sign-in; signed-in users routed by role
    me/                       Student: current status, self check-out, hours, history
    checkin/route.ts          GET /checkin?m=&t=  (the URL in the QR) -> validates token, sets scan-proof cookie
    checkin/confirm/          Login (if needed) + "Check in" / "Check out" confirmation
    checkin/actions.ts        Server actions: scan check-in, scan check-out, self check-out
    dashboard/                Day view (mentor+); reduced "who's here" view for students
    kiosk/                    Fullscreen QR + live attendee list (mentor+)
    admin/hours/              Season table, charts, CSV export link (mentor read-only, admin)
    admin/students/[id]/      Per-meeting breakdown + admin edit/add controls
    admin/meetings/           List/open/close; [id] = details, attendees, manual add, edit, delete
    admin/roster/             Add one, bulk paste, edit name/role/active, delete
    admin/seasons/            Create, edit, set current, delete
    api/auth/[...nextauth]/   Auth.js handlers
    api/kiosk/                Kiosk poll endpoint (token, QR SVG, attendees) - mentor+
    api/admin/hours/export/   CSV export - mentor+
    api/cron/auto-checkout/   Daily 9 PM auto check-out sweep (Vercel Cron, CRON_SECRET)
  db/
    schema.ts                 Drizzle schema (users, seasons, meetings, checkins)
    index.ts                  Lazy DB client (Neon HTTP; local Docker proxy; dev-only PGlite)
    types.ts                  Driver-agnostic DB type used by the data layer
  lib/
    auth.ts                   Auth.js config (Google, sign-in policy, DB upsert)
    authz.ts                  getCurrentUser / requirePageUser / requireRole (role read from DB per request)
    signin-policy.ts          Pure sign-in decision (domain, roster, inactive, bootstrap admins)
    checkin-token.ts          HMAC rotating tokens (30s windows, current + previous accepted)
    scan-proof.ts             Signed short-lived "valid scan" cookie
    attendance.ts             Mutations: check in/out, open/close meeting, manual add/edit/delete, set season
    queries.ts                Reads: day view, season report, student detail, attendees
    hours.ts                  Hours / attendance math (pure)
    time.ts                   Team-timezone day boundaries and formatting (Intl only, DST-safe)
    cidr.ts                   IPv4/IPv6 CIDR matching, client IP from x-forwarded-for
    flags.ts                  Check-in flag computation and labels
    report.ts                 Sorting + CSV (with formula-injection protection)
    roster.ts                 Bulk roster paste parser
    env.ts                    Lazy env access (nothing read at build time)
drizzle/                      Generated SQL migrations
scripts/seed.ts               Demo data (npm run db:seed)
tests/                        Vitest unit + PGlite integration tests
```

**Rendering model.** Every page is per-user, so the root layout sets `dynamic = "force-dynamic"`
and Cache Components are deliberately not enabled. Nothing touches the database at build time;
the DB client is created lazily on first query, so `next build` succeeds without any env vars.

**Data layer.** Data functions in `lib/attendance.ts` and `lib/queries.ts` take a `db` argument
typed as a generic Drizzle Postgres database. Production passes the Neon HTTP client; the
integration tests pass PGlite with the real migration applied.

**Realtime without WebSockets.** The kiosk polls `/api/kiosk` every 4s with SWR (new QR + attendee
list). The dashboard calls `router.refresh()` every 10s while the tab is visible.

### Data model

| table | key columns |
|---|---|
| `users` | `id`, `email` (unique, lower-case), `name`, `image`, `role` (`student`/`mentor`/`admin`), `active`, `last_login_at` |
| `seasons` | `id`, `name`, `start_date`, `end_date`, `is_current` (partial unique index: at most one current), `hours_target` (numeric, default 80, null = none), `target_visible_from` (date, null = from the start) |
| `meetings` | `id`, `season_id`, `starts_at`, `ends_at`, `is_open` (partial unique index: at most one open), `opened_by`, `notes` |
| `checkins` | `id`, `student_id`, `meeting_id`, `checked_in_at`, `checked_out_at`, `ip`, `device_id`, `flags text[]`, `manual_adjusted_by`, `manual_adjusted_at`, **UNIQUE(student_id, meeting_id)** |

All timestamps are `timestamptz` (UTC). Display and "day" boundaries use `TEAM_TIMEZONE`.

### Roles

| | student | mentor | admin |
|---|:-:|:-:|:-:|
| Check in/out themselves, see own hours (`/me`) | ✓ | ✓ | ✓ |
| "Who's here now" (today only) | ✓ | ✓ | ✓ |
| Full day view with any date, absent list, flags | | ✓ | ✓ |
| Start/close meetings, run kiosk, edit meeting notes | | ✓ | ✓ |
| Season hours table, student detail, CSV export (read-only) | | ✓ | ✓ |
| Edit/add/delete check-ins, edit meeting times, delete meetings | | | ✓ |
| Roster and seasons | | | ✓ |

Every page, route handler, and server action checks the role on the server (`lib/authz.ts`). The
JWT only stores the user's DB id. Role and `active` are read from the database on every request,
so a role change or deactivation applies right away.

### Check-in flow

1. A mentor clicks **Start meeting**, which creates an open meeting in the current season. `/kiosk` shows the QR.
2. The QR encodes `${APP_URL}/checkin?m=<meetingId>&t=<token>`, where
   `token = base64url(HMAC-SHA256(CHECKIN_SECRET, "<meetingId>:<floor(now/30s)>"))[:16 bytes]`.
   Nothing is written to the database for tokens.
3. `GET /checkin` validates the token (current or previous window, constant-time compare)
   **before any login**. If it's valid, it sets an httpOnly signed `frc_scan` cookie (meeting id + time,
   valid 10 minutes) and a long-lived random `frc_device` cookie, then redirects to `/checkin/confirm`.
   So it doesn't matter if the 30-60s token expires while the student signs in with Google.
4. `/checkin/confirm` asks the student to sign in if needed (Google returns them here), then shows one
   large button: **Check in** if they're not checked in, or **Check out now** / **Stay checked in** if they are.
   The action needs a valid scan proof for that meeting, uses it up, and inserts with
   `INSERT ... ON CONFLICT (student_id, meeting_id) DO NOTHING` so repeats are harmless.
5. **Check-out choice.** Check-in *requires* a scan. Check-out works by scanning again **or** with the
   **Check out** button on `/me` without scanning. Button check-outs get the `self_checkout` flag. This is
   no weaker than forgetting to check out, since closing the meeting checks everyone out at its end time anyway.
6. **Close meeting** sets `ends_at` and gives every remaining open check-in `checked_out_at = ends_at` plus
   the `auto_checkout` flag. Running it again is safe.
7. Each meeting has one row per student. Once a student has checked out they can't check back in to the
   same meeting; a mentor/admin can fix the times instead.
8. **Daily cutoff (9:00 PM, `DAILY_CHECKOUT_TIME`).** Any check-in still open at the cutoff on its check-in
   day (team timezone, DST-safe) is closed at exactly the cutoff with the `auto_checkout_9pm` flag, and any
   meeting still open past it is closed (at the cutoff, or its own `ends_at` if earlier). This "sweep" is
   idempotent and runs on the check-in/check-out actions, the kiosk API, and dashboard / me / hours /
   meetings page loads, so it's correct even if the cron never fires; a Vercel Cron job
   (`vercel.json`, `GET /api/cron/auto-checkout`) also runs it once a day. New check-ins (and new meetings)
   after the cutoff are refused with "Check-in is closed for today".

### Flags (signals only, never blocks)

| flag | meaning |
|---|---|
| `off_network` | `SCHOOL_IP_RANGES` is set and the client IP (first `x-forwarded-for` hop) is outside all ranges |
| `shared_device` | The same `frc_device` cookie checked in a different student in the same meeting. Both rows are flagged |
| `no_device` | No device cookie was present (cookies blocked/cleared) |
| `self_checkout` | Checked out from `/me` without scanning |
| `auto_checkout` | Checked out automatically when the meeting closed |
| `auto_checkout_9pm` | Still checked in at the daily cutoff (`DAILY_CHECKOUT_TIME`, default 9:00 PM); closed at exactly the cutoff |
| `manual` | Added by an admin |
| `edited` | Times edited by an admin (`manual_adjusted_by/at` record who and when) |

No geolocation is collected.

### Hours

- A check-in counts `checked_out_at - checked_in_at` (never negative), capped at the daily cutoff (9:00 PM) of
  its check-in day. Open check-ins count 0 until they're closed.
- **Season target.** Each season has an hours target (default 80). From `target_visible_from` (e.g. Jan 9)
  students see "52.5 / 80 hrs · 27.5 to go" with a progress bar on `/me` and their check-in confirmation;
  before that they see hours only. Mentors always see met / not-met on the hours and student pages and in the CSV.
- **Names.** Students are shown as first name + last initial ("Ben O.") everywhere (kiosk, dashboards,
  hours, charts, CSV); mentors/admins keep full names. The database stores the full name. The roster page
  shows emails (needed to manage accounts), which may contain last names.
- Attendance % = meetings attended ÷ meetings in the season that have started.
- The season table shows students by default. Choose "Everyone" to include mentors/admins. Inactive people
  are hidden unless they attended that season.

---

## Local setup

Requires Node 20+.

```bash
npm install
cp .env.example .env.local      # then fill in values (see below)
```

Pick one database option:

**A. Neon dev branch (closest to production).** In the Neon console, create a project (or a `dev`
branch of your production project). Copy the **pooled** connection string into `DATABASE_URL` and,
optionally, the direct one into `DATABASE_URL_UNPOOLED`.

**B. Docker Postgres.** Uses Neon's local HTTP proxy, so the same driver runs locally:

```bash
docker compose up -d
# .env.local:
DATABASE_URL="postgres://postgres:postgres@db.localtest.me:5432/main"
```

**C. Zero-install demo (development only).** An embedded WASM Postgres stored in `./.data`:

```bash
# .env.local:
DATABASE_URL="pglite://.data/pglite"
```

PGlite is single-process, so stop `npm run dev` before running migrations or the seed script.

Then:

```bash
npm run db:migrate     # apply drizzle/ migrations (db:seed also applies them)
npm run db:seed        # demo season, 18 students, 6 weeks of meetings, an open meeting today
                       # (refuses a non-empty DB; `npm run db:seed -- --force` TRUNCATES and reseeds)
npm run dev            # http://localhost:3000
```

Put your own Google address in `ADMIN_EMAILS` before your first sign-in so you become an admin.

### Scripts

| script | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (unit + PGlite integration) |
| `npm run db:generate` | Generate a new migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` / `db:studio` | drizzle-kit push / studio |
| `npm run db:seed` | Demo data |

To test QR scanning with a phone during local dev, set `APP_URL` to a URL the phone can reach
(for example your LAN IP: `http://192.168.1.20:3000`, and add that origin to Google's allowed
redirect URIs), or use a tunnel.

---

## Google OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/), create or select a project.
2. **APIs & Services → OAuth consent screen**: choose *Internal* if you're on Google Workspace (only
   your school domain can sign in) or *External*. Add the `email`, `profile`, and `openid` scopes.
   For External apps, publish the app or add test users.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorized JavaScript origins: `http://localhost:3000`, `https://<your-app>.vercel.app` (and any custom domain)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://<your-app>.vercel.app/api/auth/callback/google`
     - `https://<custom-domain>/api/auth/callback/google` (if used)
4. Copy the client ID/secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

Preview deployments get random URLs that Google won't accept as redirect URIs. Test sign-in on
production or on a fixed preview alias.

---

## Environment variables

| variable | required | description |
|---|:-:|---|
| `DATABASE_URL` | ✓ | Neon **pooled** connection string (or a local option above) |
| `DATABASE_URL_UNPOOLED` | | Neon direct connection, preferred by migrations/seed |
| `AUTH_SECRET` | ✓ | Auth.js JWT encryption secret (`npx auth secret` or `openssl rand -base64 33`) |
| `AUTH_GOOGLE_ID` | ✓ | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | ✓ | Google OAuth client secret |
| `CHECKIN_SECRET` | ✓ | ≥32 random chars; signs QR tokens and scan-proof cookies (`openssl rand -base64 48`) |
| `APP_URL` | | Public base URL put in QR codes. Defaults to `https://$VERCEL_PROJECT_PRODUCTION_URL`, then the request origin |
| `ALLOWED_EMAIL_DOMAIN` | | e.g. `school.org`. Other domains are rejected (exact match, subdomains not allowed) |
| `ADMIN_EMAILS` | | Comma-separated. Always admins and always allowed in (domain rule still applies) |
| `REQUIRE_ROSTER` | | `true` = only emails already on the roster can sign in. Otherwise new users are created as students |
| `SCHOOL_IP_RANGES` | | Comma-separated CIDRs (IPv4/IPv6) of the school's public egress IPs, for the `off_network` flag |
| `TEAM_TIMEZONE` | | IANA zone for display and day boundaries. Default `America/New_York` |
| `TEAM_NAME` | | Shown in the header and on the kiosk |
| `DAILY_CHECKOUT_TIME` | | Daily auto check-out / check-in cutoff, `HH:MM` 24h in `TEAM_TIMEZONE`. Default `21:00` |
| `CRON_SECRET` | | Random string; Vercel sends it as `Authorization: Bearer …` to `/api/cron/auto-checkout`. Without it the cron route returns 401 (the per-request sweep still runs) |
| `AUTH_URL` | | Only needed outside Vercel behind a proxy |

---

## Deploying to Vercel (Hobby)

1. Create a Neon project (free tier). Copy the pooled and direct connection strings.
   (Or add Neon from the Vercel Marketplace, which sets `DATABASE_URL`/`DATABASE_URL_UNPOOLED` for you.)
2. Run the migrations against Neon from your machine:
   `DATABASE_URL_UNPOOLED="<direct url>" npm run db:migrate`
3. Push the repo to GitHub and import it in Vercel (framework: Next.js; the default build command works).
4. Set the environment variables above in **Project → Settings → Environment Variables**
   (`APP_URL` = your production URL).
5. Deploy. Add the production callback URL to the Google OAuth client.
   Set `CRON_SECRET` so the daily auto check-out cron (`vercel.json`, `0 2 * * *` UTC) can call
   `/api/cron/auto-checkout`. Hobby crons run once a day and may fire any time within the hour; 02:00 UTC is
   9-10 PM in New York in both EST and EDT. The sweep always stamps exactly the cutoff, whenever it runs.
   If you change `TEAM_TIMEZONE` or `DAILY_CHECKOUT_TIME`, pick a UTC hour that is after the cutoff year-round.
6. Sign in with an `ADMIN_EMAILS` account. Create a season (Seasons), add the roster (Roster → bulk paste),
   then start a meeting from **Kiosk** on a laptop or TV next to the door.

For later schema changes: edit `src/db/schema.ts`, run `npm run db:generate`, commit the new file in
`drizzle/`, then `npm run db:migrate` against Neon before or right after deploying.

Neon's free tier suspends compute when idle, so the first request after a quiet period can take a
second or so. Polling stops while the kiosk/dashboard tab is hidden, which keeps usage low.

---

## Security model and its limitations

What's enforced:

- **Authentication**: Google only, verified email required, optional domain restriction and roster
  requirement, deactivated users are blocked. Roles come from the DB on every request.
- **Authorization**: checked on the server in every page, route handler, and server action. Server
  actions can be called directly, so each one authorizes itself. All input is validated with zod.
- **Presence**: a check-in needs a kiosk QR token that is at most 60s old, signed with `CHECKIN_SECRET`.
  The scan proof cookie is httpOnly, HMAC-signed, tied to one meeting, lasts 10 minutes, and is used up by one action.
- **Integrity**: one row per student per meeting (DB unique constraint), at most one open meeting and one
  current season (partial unique indexes), admin edits record who changed what, CSV export protects
  against formula injection, redirect targets are restricted to same-site paths.

Known limitations (by design for a free, low-friction system):

- **QR forwarding.** A student at the meeting can photograph or forward the QR/URL, and a friend elsewhere can
  use it within its 30-60s window (and the friend then has 10 minutes to finish signing in). Rotation
  limits this but can't stop it. `off_network` (with `SCHOOL_IP_RANGES`) and mentor review of the live
  kiosk list are the mitigations. For stronger assurance, have a mentor glance at the kiosk's live
  "Here now" list against who is actually in the room.
- **Shared phones.** One phone checking in several students is *flagged*, not blocked (a student may
  legitimately lend a phone). Clearing cookies or using a private window avoids the flag; it is a signal, not proof.
- **IP signal.** `x-forwarded-for` is set by Vercel's edge and is reliable there, but a school's egress IP
  may be shared with phones on cellular-to-Wi-Fi handoff, VPNs, and so on. CGNAT and IPv6 make ranges inexact.
  Treat `off_network` as a hint.
- **Self check-out.** Students can check out from `/me` without scanning (flagged `self_checkout`). They can't
  add hours this way that they wouldn't also get from auto check-out at meeting close.
- **Meeting length.** If a mentor forgets to close a meeting, open check-ins keep running until it's closed.
  Close meetings promptly, or have an admin fix `ends_at` and the check-out times.
- **JWT sessions** can't be revoked one at a time before they expire (30 days). Deactivating a user or
  changing their role still takes effect right away, because every request re-reads the user from the DB.
  Rotating `AUTH_SECRET` signs everyone out.
- Rotating `CHECKIN_SECRET` immediately invalidates displayed QR codes and any pending scan proofs.
