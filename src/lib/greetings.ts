import { formatDuration, MS_PER_HOUR } from "./hours";
import { fmt } from "./target";
import { zonedParts } from "./time";

/**
 * Friendly copy for the check-in / check-out confirmation screens.
 * Pure: everything (time, timezone, name, context, seed) is passed in.
 */

export const CHECKIN_LINES = [
  "Glad you're here. Let's build something great.",
  "Another day closer to competition.",
  "The robot won't build itself. Good thing you're here.",
  "Every hour in the shop shows up on the field.",
  "Great to see you. Let's make today count.",
  "Time to turn some CAD into reality.",
  "Gracious professionalism, full speed ahead.",
  "Small fixes today, big matches later.",
  "Your team's better with you here.",
  "Let's get some good iterations in.",
  "Make your mark today.",
  "Your impact is felt every time you're here.",
  "Your presence makes a difference every day.",
] as const;

export const CHECKOUT_LINES = [
  "Great work today. See you next time!",
  "Thanks for putting in the time.",
  "Get some rest, you earned it.",
  "Solid session. The robot thanks you.",
  "Nice work. Every hour counts toward the season.",
  "That's a wrap for today. Well done.",
  "Thanks for showing up for the team.",
  "Progress made. See you at the next meeting!",
  "Good stuff today. Get home safe.",
  "Another session in the books. Nice job.",
  "Thanks for the effort. It adds up.",
  "Rest up and come back with fresh ideas.",
  "Thanks for your hard work - it makes a difference.",
  "Every hour you put in brings the team closer to success.",
  "Your dedication drives the team forward.",
] as const;

export const HOUR_MILESTONES = [25, 50, 100] as const;

export type TimeOfDay = "morning" | "afternoon" | "evening";

/** Before 12:00 morning; 12:00 up to (not including) 17:00 afternoon; 17:00 on evening. */
export function timeOfDay(now: Date, tz: string): TimeOfDay {
  const { hour } = zonedParts(now, tz);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function greeting(now: Date, tz: string, firstName: string): string {
  const name = firstName.trim();
  return `Good ${timeOfDay(now, tz)}${name ? `, ${name}` : ""}!`;
}

/** Stable string hash (FNV-1a) so a given check-in always shows the same line. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pickLine<T extends readonly string[]>(lines: T, seed: string): T[number] {
  return lines[hash(seed) % lines.length];
}

export type ConfirmationContext =
  | {
      kind: "in";
      /** True when this is the student's first check-in of the season. */
      firstOfSeason?: boolean;
    }
  | {
      kind: "out";
      /** Length of the session that just ended (already capped). */
      sessionMs?: number | null;
      /** Season total including this session. */
      seasonMsAfter?: number | null;
      hoursTarget?: number | null;
    };

export type Milestone = { kind: "target" | "hours" | "first"; text: string };

export type ConfirmationMessage = {
  greeting: string;
  line: string;
  /** "You put in 2h 15m today" (check-out only). */
  session: string | null;
  milestone: Milestone | null;
};

/**
 * Milestone precedence (highest wins): crossing the season target, then the
 * largest round-hour milestone crossed this session, then first check-in.
 */
export function milestoneFor(ctx: ConfirmationContext): Milestone | null {
  if (ctx.kind === "in") {
    return ctx.firstOfSeason ? { kind: "first", text: "Your first check-in of the season. Welcome aboard!" } : null;
  }
  if (!ctx.sessionMs || ctx.seasonMsAfter === null || ctx.seasonMsAfter === undefined) return null;
  // Compare at display precision (one decimal) so the message matches the numbers shown.
  const after = Math.round((ctx.seasonMsAfter / MS_PER_HOUR) * 10) / 10;
  const before = Math.round(((ctx.seasonMsAfter - ctx.sessionMs) / MS_PER_HOUR) * 10) / 10;
  const target = ctx.hoursTarget;
  if (target && target > 0 && before < target && after >= target) {
    return { kind: "target", text: `You hit ${fmt(target)} hours — minimum met! 🎉` };
  }
  const crossed = HOUR_MILESTONES.filter((m) => before < m && after >= m);
  if (crossed.length) {
    return { kind: "hours", text: `You just passed ${crossed[crossed.length - 1]} hours this season. Huge!` };
  }
  return null;
}

export function confirmationMessage(input: { now: Date; tz: string; firstName: string; seed: string; context: ConfirmationContext }): ConfirmationMessage {
  const { now, tz, firstName, seed, context } = input;
  const milestone = milestoneFor(context);
  const lines = context.kind === "in" ? CHECKIN_LINES : CHECKOUT_LINES;
  const session =
    context.kind === "out" && context.sessionMs && context.sessionMs >= 60_000 ? `You put in ${formatDuration(context.sessionMs)} today` : null;
  return {
    greeting: greeting(now, tz, firstName),
    line: milestone ? milestone.text : pickLine(lines, `${context.kind}:${seed}`),
    session,
    milestone,
  };
}
