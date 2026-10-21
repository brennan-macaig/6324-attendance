# 6324 Generative Tool UI Standards

**Audience:** an AI coding agent (or a human) starting a *new* internal tool for team 6324 — not necessarily in this repo. This document exists so every tool we build (attendance, inventory, scouting, whatever comes next) looks and behaves like one family of software, without hand-copying code between repos.

This document describes a **look and a set of rules**, not a library. There is no shared npm package to install. Reproduce the tokens and patterns below in the new project's own `globals.css` / component files, adjusted for whatever that tool actually needs. If the new tool is itself a Next.js + Tailwind + TypeScript app, you can copy the referenced files from this repo (`src/app/globals.css`, `src/components/ui.tsx`, `src/components/button-class.ts`, `src/components/nav-bar.tsx`, `src/components/action-form.tsx`) nearly verbatim and just change the brand hue, team name, and nav links. If it's a different stack, treat every CSS value and layout rule here as the spec to re-implement, not literal code to paste.

The canonical, living implementation of everything in this document is the `frc-attendance` app (this repo). When in doubt, read the real source there — this file summarizes and explains it, but the code is the source of truth if they ever disagree.

---

## 1. Design philosophy

Influences: **UniFi, Apple, Stripe, Shopify Polaris, Tailwind UI.** The target feel is a polished, professional admin console — not a generic Bootstrap/default-Tailwind app, and not a flashy consumer product. Specifically:

- **Calm, information-dense surfaces.** White/near-white cards on a very light gray canvas (light mode), flat dark panels on near-black (dark mode). No gradients or decoration on ordinary UI — the one permitted exception is a soft radial glow on full-bleed "hero" surfaces like the kiosk screen.
- **One dark, saturated header color**, used nowhere else in the UI except as that one accent's tints (buttons, links, focus rings, chart bars). The header is never gray.
- **Restraint in color.** Status (success/warning/danger) and the brand accent are the only colors with meaning. Everything else is ink-on-canvas grayscale.
- **Real data over decoration.** Numbers are precise and `tabular-nums`-aligned. Icons are small and functional (lucide-react only), never illustrative/decorative filler.
- **Every state is designed**, not an afterthought: empty states, loading states, and error states get the same care as the "happy path."
- **Light and dark mode are both first-class**, driven automatically by `prefers-color-scheme` — never a manual toggle the user has to find.

## 2. Assumed stack (adjust if different)

This repo is Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + `lucide-react` + Drizzle ORM/Postgres. Tailwind v4's `@theme` block compiles design tokens into real CSS custom properties (`--color-*`), which is what makes the theming trick in §4.6 possible — utility classes like `bg-accent` resolve to `var(--accent)` under the hood, so redefining `--accent` in a scoped selector re-themes every utility that uses it, no utility-class rewriting required. If you're on a different CSS system, reproduce this with plain CSS custom properties — the principle (semantic tokens that reference a raw color scale, never raw hex in components) is what matters, not Tailwind specifically.

## 3. Design tokens

All values below are **light mode**; dark-mode overrides are listed in §3.5. Reproduce these as CSS custom properties (or your framework's equivalent token system) — never hardcode a hex value inside a component.

### 3.1 Brand / header color scale

Pick **one hue** per tool and generate an 11-step scale (50 lightest → 950 darkest) in that hue. This repo's default is navy/blue:

```
50  #eef3fe   100 #dce6fd   200 #c0d2fb   300 #94b3f7
400 #6690f1   500 #3f6fe6   600 #2f62db   700 #244dbb
800 #1f3f94   900 #172f5c   950 #0b1f3a
```

Usage contract for the scale, regardless of hue:
- **950** → the header background (`--header`). Must be dark enough for white text at ~10:1+ contrast.
- **900** → header border/divider (`--header-line`), one step lighter than the header itself.
- **600** → the primary accent (`--accent`) — buttons, links, selected states. Pick a shade dark enough that **white text on it clears ~4.5:1 contrast.** (Saturated hues like orange/yellow often need their "600" pulled much darker than you'd expect to hit this — don't trust the hue's default mid-tone.)
- **700** → accent hover/active (`--accent-hover`, `--accent-ink` for links on light surfaces).
- **400** → "active" indicator color used *on top of* the dark header (underlines, live progress bars) — needs to read clearly against the 950 background.
- **200** → light-on-dark text tint for header copy (`--header-ink`) and ring colors for soft accent badges.
- **100** → avatar fallback background.
- **50** → accent-soft background (tinted chips, soft button fills).

This repo additionally ships five alternate colorways (teal, green, purple, red, orange) as a *site-wide, admin-selectable* option — see `src/lib/theme.ts` and the `[data-theme="..."]` blocks in `src/app/globals.css` for worked examples of full scales in other hues, including the exact contrast reasoning for each. Reuse those hex values directly if one of those colors fits the new tool.

### 3.2 Semantic tokens (swap per color scheme; never hardcode)

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#f5f7fa` | `#0a101c` | Page background |
| `surface` | `#ffffff` | `#111a2b` | Cards, panels |
| `surface-2` | `#f8fafc` | `#0e1626` | Table header row, subtle fills |
| `surface-hover` | `#f3f6fa` | `#16223a` | Row/list hover |
| `line` | `#e3e8ef` | `#1f2b40` | Default border |
| `line-strong` | `#cbd3de` | `#2d3b54` | Input borders, emphasis borders |
| `ink` | `#0f172a` | `#e6ebf2` | Primary text |
| `ink-2` | `#475569` | `#a7b1c2` | Secondary text |
| `ink-3` | `#5d6b80` | `#8691a4` | Tertiary/muted text, placeholders |
| `accent` / `accent-hover` / `accent-soft` / `accent-ink` | brand-600 / 700 / 50 / 700 | brand-600 / brand-500(hover) / 16%-alpha / brand-300 | Primary actions, links |
| `ring` | brand-500 | brand-400 | Focus ring color |
| `header` / `header-line` / `header-ink` / `header-active` | brand-950 / 900 / 200 / 400 | **same as light** — the header does not change with color scheme | App header |
| `success` / `success-ink` / `success-soft` / `success-line` | `#16a34a` / `#067647` / `#ecfdf3` / `#abefc6` | `#22c55e` / `#75e0a7` / 12%-alpha / 30%-alpha | Positive status |
| `warning` / `warning-ink` / `warning-soft` / `warning-line` | `#f79009` / `#93370d` / `#fffaeb` / `#fedf89` | `#fdb022` / `#fec84b` / 12%-alpha / 32%-alpha | Caution, flags |
| `danger` / `danger-hover` / `danger-ink` / `danger-soft` / `danger-line` | `#c8321f` / `#a92a1a` / `#b42318` / `#fef3f2` / `#fecdca` | `#d92d20` / `#f04438` / `#fda29b` / 12%-alpha / 32%-alpha | Destructive actions, errors |
| `neutral-soft` / `neutral-ink` / `neutral-line` | `#f1f4f8` / `#344054` / `#dfe4eb` | 12%-alpha gray / `#cbd3de` / 22%-alpha gray | Neutral badges (roles, "Left"/"Absent" states) |

**Rule:** success/warning/danger are semantic and fixed across every tool and every colorway — they must never be reassigned to mean something else, and they must never be the tool's brand/accent color (so "this is dangerous" is never confusable with "this is just branded").

### 3.3 Typography

- Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, "Helvetica Neue", system-ui, sans-serif` — system fonts, no webfont loading.
- Monospace (for code/ids only): `ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace`.
- Body copy: 15px (`text-[15px]`) with `letter-spacing: -0.005em` and `font-feature-settings: "cv11", "ss01"` globally.
- Page title (`<h1>`): `1.625rem`→`1.75rem` at `sm:`, weight 600, `tracking-[-0.02em]`.
- Card/section title (`<h2>`): `15px`, weight 600, `tracking-[-0.01em]`.
- Stat/metric value: `1.625rem`→`1.75rem`, weight 600, `leading-none`, `tracking-[-0.02em]`.
- Secondary/caption text: `13px`, `ink-2` or `ink-3`.
- Badge/label text: `12px` (`text-xs`), weight 500.
- **Numbers that represent quantities (hours, counts, times, percentages) always get `font-variant-numeric: tabular-nums`** (the `.tabular` utility class) so columns of numbers align. Apply this to any digit grid — stat tiles, table cells, countdown timers.
- Case: **sentence case everywhere** — labels, buttons, nav items, headings. Never Title Case, never ALL CAPS except the rare 11px uppercase "eyebrow" label (`tracking-[0.12em]`) above a hero title, which is tracked wide specifically to read as a label, not a shout.

### 3.4 Spacing, radius, shadow, motion

- Radius scale: `--radius-control: 0.5rem` (inputs, buttons, small chips), `--radius-card: 0.75rem` (cards, panels, QR frame), `--radius-panel: 1rem` (large hero panels). Pills/avatars/dots are always `rounded-full`.
- Shadow scale (light mode values shown; dark mode uses black-based equivalents at higher opacity — see `globals.css`):
  - `shadow-xs`: `0 1px 2px rgb(15 23 42 / .05)` — resting cards, inputs.
  - `shadow-card`: `0 1px 2px rgb(15 23 42 / .04), 0 1px 3px rgb(15 23 42 / .06)` — cards that should feel slightly more raised.
  - `shadow-pop`: `0 12px 32px -8px rgb(15 23 42 / .18), 0 4px 8px -4px rgb(15 23 42 / .08)` — popovers, dropdown menus, modals.
- Page container: `mx-auto max-w-6xl px-4 sm:px-6`, vertical rhythm `pt-6 sm:pt-10 pb-16`.
- Grid gaps: `gap-3` for stat tile grids, `gap-6` between major page sections.
- Motion: three keyframes only — `fade-in-up` (opacity 0→1 + translateY(4px)→0, 0.35s), `pop-in` (opacity + scale(0.96)→1 + slight translateY, 0.16s, used for popovers/menus), `soft-ping` (the live-dot pulse, 2s infinite). Timing function `cubic-bezier(0.22, 1, 0.36, 1)` ("ease-out-soft") for the first two. **All of it is disabled under `prefers-reduced-motion: reduce`** — this is non-negotiable, wire it up globally (`* { transition-duration: 0.01ms !important }` plus `animation: none` on the three classes above), don't handle it per-component.

### 3.5 Dark mode

Driven entirely by `@media (prefers-color-scheme: dark)` — there is no manual light/dark toggle anywhere in the product. Every semantic token in §3.2 gets a dark-mode value; raw brand-scale values and the header/accent tokens stay **identical** in both modes (the header is always the same navy/teal/whatever, in both schemes — only the page chrome around it changes). When you add any new color anywhere, add its dark-mode pair in the same commit; a token that only has a light-mode value is a bug.

## 4. Layout patterns

### 4.1 App shell

- A single sticky header (`sticky top-0 z-40`), height `h-14`, background = `--header`, text = `--header-ink` by default / white for emphasis. Contains, left to right: a small square brand mark (rounded, gradient-filled, one glyph — see §4.2), the team/tool name, primary nav (desktop only, `md:flex`), then an account menu pinned right.
- Below `md`, primary nav collapses to either a slide-down menu (hamburger icon, for 3+ destinations) or a segmented tab bar directly under the header (for exactly 1–2 destinations — e.g. a student's "Me" / "Who's here" is a 2-tab bar, not a hamburger menu). Don't build a hamburger for two items.
- Main content: `<main>` inside `mx-auto max-w-6xl px-4 sm:px-6`. A visually-hidden "Skip to content" link is the very first focusable element in `<body>`, becoming visible on focus.
- Every page starts with a `PageHeader`: an optional small "eyebrow" label, an `<h1>`, an optional subtitle, and optional right-aligned actions (buttons, a date picker, etc.) that wrap onto their own line on narrow screens rather than overflow.

### 4.2 Brand mark

A small (28px default) rounded square, `bg-gradient-to-b from-{brand-400} to-{brand-600}`, inset top highlight + subtle drop shadow (`shadow-[inset_0_1px_0_rgb(255_255_255/.25),0_1px_2px_rgb(0_0_0/.3)]`), containing one small white-stroked icon from lucide-react, sized to ~60% of the square. Pick one icon that represents the tool; don't use a photo or a multi-color logo here.

### 4.3 Cards

The base content container everywhere. `rounded-card border border-line bg-surface shadow-card`, `overflow-clip` (not `hidden` — needed so sticky table headers inside still work). Optional header row (title + description on the left, actions/counts on the right) separated from the body either by just spacing (default) or a full-width border + tighter padding when the content is a table/list that should run edge-to-edge (the `flush` variant).

### 4.4 Stat tiles

A 2-up (mobile) → 3-or-4-up (desktop) grid of small metric cards: muted label (with an optional live-dot or warning-triangle indicator) above a large tabular value, with an optional muted hint line below. Use for "at a glance" numbers at the top of a dashboard — never more than 4 in a row, never as the *only* content on a page (always paired with a table/list below).

### 4.5 Tables

- Sticky header (`md:sticky md:top-14`, i.e. sticks just below the app header) on screens `md` and up; horizontal scroll container on narrower screens instead of trying to make the table responsive by hiding columns.
- Header cells: small, muted, medium-weight, uppercase is **not** used here (sentence case, unlike some admin-UI conventions) — `text-xs font-medium text-ink-3` on a `surface-2` background.
- Body rows: hover highlight (`hover:bg-surface-hover`), no zebra striping. Numeric columns are right-aligned + tabular. The *first* column (usually a name) is a styled link (underline-on-hover only, not persistent) rather than a separate "view" button/icon.
- Every border is a bottom border only (`border-b`), removed on the last row — tables read as a stack of hairlines, not a boxed grid.

### 4.6 Theming mechanism (if the tool needs more than one brand color, e.g. white-labeling)

Define the full brand-50..950 scale, plus everything derived from it (`--header*`, `--accent*`, `--ring`, chart series colors), as CSS custom properties. Ship alternate full scales under an attribute selector, e.g. `[data-theme="teal"] { --color-brand-600: ...; }`, placed **after** your dark-mode media query block in the stylesheet (same selector specificity as `:root`/the media query, so source order decides — later wins). Set the attribute server-side on `<html>` based on whatever picked the theme (a DB setting, a config file, a URL param) — never client-side-only, or you'll get a flash of the wrong theme. See `src/app/globals.css` (search `data-theme`) and `src/app/layout.tsx` (`generateViewport` + the `data-theme` attribute on the root layout) for the full worked implementation, including updating the browser's own `theme-color` meta tag to match.

## 5. Component catalog

Build these once per tool (or copy from `src/components/` in this repo) and never one-off a card/button/badge/input by hand elsewhere.

- **Button** (`button-class.ts`): 6 variants — `primary` (filled accent), `secondary` (surface + border, for anything non-primary including "Cancel"), `ghost` (text-only, for low-emphasis actions in toolbars), `danger` (filled red, for the *confirmed* destructive action itself), `danger-soft` (surface + red text/border, for a button that *opens* a destructive flow, e.g. "Delete"), `success` (filled green, rare — e.g. "Mark present"). 4 sizes, `sm`→`xl`. Every button has `active:scale-[0.985]` press feedback and a visible 2px focus ring offset outside the element.
- **Form fields**: `inputClass`/`selectClass`/`textareaClass`/`labelClass` constants + a `Field` wrapper (label + control + optional hint, stacked). Inputs are 36px tall (`h-9`), bordered, with a 3px accent-tinted focus ring — never a plain browser outline, never no visible focus state.
- **Server-action forms**: wrap every mutation in an `ActionForm` (see `src/components/action-form.tsx`) — a client component around `useActionState` that shows an `aria-live` success/error message inline under the form, optionally gates submission behind a native `confirm()` for destructive actions, and optionally resets the form on success. Submit buttons show a spinner + "Working…" (or a custom pending label) while pending and disable themselves — never leave a submit button clickable twice.
- **Badges**: small pill, `h-[22px]`, `rounded-full`, `ring-1 ring-inset`, one of 6 tones (neutral/success/warning/danger/accent/violet — violet is reserved for a "mentor"-style middle role tier, don't reuse it for anything else). Status that matters (here/left/absent, met/not-met, flags) is **always a labelled badge**, never a bare colored dot with no text — color reinforces meaning, it never carries meaning alone.
- **Avatar**: photo if available (circular, 1px ring), otherwise initials-on-tint using the brand-100/800 (light) or brand-900/200 (dark) pair.
- **EmptyState**: icon-in-a-circle + short title + one muted sentence + optional single action. Every list/table that *can* be empty must define one of these — "no data" is never just a blank card.
- **Progress bar** (e.g. `TargetProgressBar`): the numeric label is the primary carrier of information (always shown, always precise); the bar itself is a secondary, decorative reinforcement — never ship a bar with no accompanying number.
- **Charts**: see `src/components/charts.tsx` and the project's `dataviz` skill/guidance for the full ruleset. Summary: one hue for single-series magnitude (the tool's accent color, contrast-validated against the card surface in both modes), thin marks with rounded data-ends, hairline grid, values rendered in `ink` text color (never colored to match the series), a hover+keyboard-focus tooltip per mark, and the same underlying data always also available in an ordinary table — a chart is never the *only* way to read a number.

## 6. Icons

`lucide-react` exclusively — no other icon set, no emoji-as-icon in UI chrome (emoji are fine in copy/greeting text, not as functional icons). Sizes: `size-4` (16px) for inline/dense contexts (nav, table cells, small badges), `size-5` (20px) for buttons/standalone controls, `size-6`+ for empty-state/hero icons. Every purely-decorative icon gets `aria-hidden`; an icon that *is* the control (no text label) needs an `aria-label` on the parent button instead.

## 7. Accessibility baseline

- Every interactive element has a visible `focus-visible` ring (`outline-2 outline-offset-2`, color = `--ring`) — never `outline-none` without a replacement.
- Every async form shows its result in an `aria-live="polite"` region, success and error both.
- Color is never the *only* signal: status badges carry text, warnings carry an icon + text, not just a color swatch.
- A live-updating value (attendee count, countdown) gets `aria-live` or `aria-label` as appropriate so it isn't silently reflowing for screen reader users.
- Skip-to-content link, semantic landmarks (`<header>`, `<main>`, `<nav aria-label="Main">`), and real `<label>`/`<Field>` associations on every input — no placeholder-as-label.
- Respect `prefers-reduced-motion` globally (§3.4) — don't make each component opt in individually.

## 8. Voice and content

- Sentence case, concise labels, no jargon in user-facing copy ("Who's here", not "Attendance Status Overview").
- Confirmations and status messages can be warm/human without being cute-at-the-expense-of-clarity (see `src/lib/greetings.ts` for the calibration: "Good morning, Alex!" + a short rotating line of encouragement + the hard numeric fact — e.g. hours this season — always present, never buried under the friendly copy).
- Error messages are specific and actionable ("This season has meetings and can't be deleted," not "Something went wrong") — reserve the generic fallback message for truly unexpected failures only.
- Destructive-action confirmations state the concrete consequence ("Delete this check-in? Their hours for this meeting will be removed.") rather than a generic "Are you sure?".

## 9. Responsive rules

- Mobile-first; breakpoints used are Tailwind's default `sm` (640px), `md` (768px), `lg` (1024px) — don't introduce custom breakpoints.
- Primary nav collapses as described in §4.1.
- Tables scroll horizontally below `md` rather than hiding columns or switching to a card-list layout.
- Role-specific views are genuinely different layouts when the underlying need differs (e.g. this repo's dashboard renders a simple "who's here" list for students vs. a full data table + date picker for mentors/admins) — don't force one dense layout onto a low-privilege user who only needs the headline answer.

## 10. Bootstrapping a new tool from this spec

1. Pick one brand hue; generate the 11-step scale per §3.1 (reuse one of this repo's documented scales — navy/teal/green/purple/red/orange — if it fits, rather than inventing a new one for every tool).
2. Copy `globals.css`'s token structure (the `@theme` block, the `@theme inline` semantic-token indirection, the `:root` + dark-media-query value sets) and substitute your scale.
3. Copy `button-class.ts`, `ui.tsx`, `action-form.tsx`, `nav-bar.tsx` wholesale; change the brand mark icon and team/tool name; delete whatever domain-specific components (badges, progress bars, etc.) don't apply and add your own following the same construction rules (§5).
4. Build the header/nav per §4.1, a `PageHeader` + `Card` skeleton for the first page, and at least one `EmptyState` before writing any real data-fetching — the shell should look finished before it does anything.
5. Verify in both light and dark mode, and at `375px`, `768px`, and `1280px`+ widths, before calling a screen done.

## 11. Do / Don't

**Do**
- Reference tokens by semantic name (`bg-accent`, `text-ink-2`) in components; keep raw hex values confined to the token definitions.
- Give every button a clear verb label ("Create season", not "Submit" or "OK").
- Keep the header the one place pure brand color dominates; keep everything else mostly grayscale.
- Show real numbers next to every bar/progress indicator.

**Don't**
- Introduce a second accent color "just for this one page."
- Use red/green/yellow for anything that isn't actually danger/success/warning.
- Build a modal when an inline `<details>` panel or a dedicated page would do (this product has no modal dialogs at all — popovers for small inline edits, full pages for everything else).
- Ship a loading state that's just a blank card, or an empty state that's just absent content with no explanation.
- Hand-roll a button, badge, or input with one-off Tailwind classes instead of using/extending the shared constants.
