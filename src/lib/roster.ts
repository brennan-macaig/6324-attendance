import { z } from "zod";

export type BulkEntry = { email: string; name: string | null };

const emailSchema = z.email();

/**
 * Parse pasted roster text. Accepts one person per line as
 *   email
 *   email, Name
 *   Name <email>
 * (any further columns, e.g. an old "Subteam" column, are ignored)
 * or a plain comma/whitespace-separated list of emails. Dedupes by email.
 */
export function parseBulkRoster(text: string): { entries: BulkEntry[]; invalid: string[] } {
  const entries = new Map<string, BulkEntry>();
  const invalid: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const angle = /^(.*?)<([^>]+)>\s*$/.exec(line);
    if (angle) {
      add(angle[2], angle[1].replace(/["']/g, "").trim() || null);
      continue;
    }
    const cells = line.split(/[,\t;]/).map((c) => c.trim());
    const restAreEmails = cells.length > 1 && cells.every((c) => c === "" || c.includes("@"));
    if (restAreEmails || cells.length === 1) {
      for (const tok of cells.flatMap((c) => c.split(/\s+/)).filter(Boolean)) add(tok, null);
    } else {
      add(cells[0], cells[1] || null);
    }
  }

  function add(raw: string, name: string | null) {
    const email = raw.trim().toLowerCase();
    if (!emailSchema.safeParse(email).success) {
      invalid.push(raw.trim());
      return;
    }
    if (!entries.has(email)) entries.set(email, { email, name });
  }

  return { entries: [...entries.values()], invalid };
}
