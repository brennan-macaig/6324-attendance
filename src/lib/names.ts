/**
 * Display names. Students are shown as first name + last initial ("Ben O.")
 * everywhere; mentors and admins keep their full name. The database always
 * stores the full name; this only changes what is rendered or exported.
 */

type Person = { name: string | null | undefined; email: string; role: string };

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

const firstChar = (s: string) => Array.from(s)[0] ?? "";
const capitalize = (s: string) => (s ? firstChar(s).toLocaleUpperCase() + s.slice(firstChar(s).length) : s);

/** "Ben Ortiz" -> "Ben O."; "Mary Ann Smith Jr." -> "Mary S."; "Cher" -> "Cher". */
export function firstNameLastInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0];
  let rest = parts.slice(1);
  while (rest.length && SUFFIXES.has(rest[rest.length - 1].toLowerCase().replace(/[.,]/g, ""))) rest = rest.slice(0, -1);
  const last = rest[rest.length - 1];
  if (!last) return first;
  const initial = firstChar(last.replace(/^[^\p{L}\p{N}]+/u, "")).toLocaleUpperCase();
  return initial ? `${first} ${initial}.` : first;
}

/**
 * Student fallback when there's no name: the email's local part, formatted
 * with the same rule ("ben.ortiz@x.org" -> "Ben O."), never the full email.
 */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local
    .split(/[._\-+]+/)
    .map((w) => w.replace(/\d+/g, ""))
    .filter(Boolean)
    .map(capitalize);
  return words.length ? firstNameLastInitial(words.join(" ")) : "Student";
}

export function displayName(p: Person): string {
  const name = p.name?.trim();
  if (p.role !== "student") return name || p.email;
  return name ? firstNameLastInitial(name) : nameFromEmail(p.email);
}

/** First name only (greetings). */
export function firstName(p: Person): string {
  return displayName(p).split(" ")[0];
}
