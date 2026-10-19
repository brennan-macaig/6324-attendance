import { describe, expect, it } from "vitest";
import { csvCell, parseSort, sortRows, toCsv } from "@/lib/report";
import { parseBulkRoster } from "@/lib/roster";

const row = (name: string, hours: number, pct: number, role = "student") => ({
  user: { name, email: `${name.toLowerCase()}@x.org`, role },
  totalMs: hours * 3_600_000,
  meetingsAttended: Math.round(pct / 10),
  attendancePct: pct,
  lastSeen: null,
});

describe("sorting", () => {
  const rows = [row("Bob", 5, 50), row("alice", 10, 40), row("Carol", 5, 90)];
  it("defaults to hours desc", () => {
    expect(parseSort(undefined, undefined)).toEqual({ key: "hours", dir: "desc" });
    expect(parseSort("name", undefined)).toEqual({ key: "name", dir: "asc" });
    expect(parseSort("evil", "sideways")).toEqual({ key: "hours", dir: "desc" });
  });
  it("sorts with name tie-break", () => {
    expect(sortRows(rows, "hours", "desc").map((r) => r.user.name)).toEqual(["alice", "Bob", "Carol"]);
    expect(sortRows(rows, "name", "asc").map((r) => r.user.name)).toEqual(["alice", "Bob", "Carol"]);
    expect(sortRows(rows, "pct", "desc").map((r) => r.user.name)).toEqual(["Carol", "Bob", "alice"]);
    expect(parseSort("subteam", undefined)).toEqual({ key: "hours", dir: "desc" });
  });
});

describe("csv", () => {
  it("escapes and neutralises formulas", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell("=HYPERLINK()")).toBe("'=HYPERLINK()");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell(null)).toBe("");
    expect(toCsv([["a", 1], ["b", 2]])).toBe("a,1\r\nb,2\r\n");
  });
});

describe("parseBulkRoster", () => {
  it("parses common paste formats and dedupes", () => {
    const { entries, invalid } = parseBulkRoster(
      [
        "a@x.org",
        "B@X.org, Bee Bop, Build",
        "Cee Dee <c@x.org>",
        "d@x.org e@x.org, f@x.org",
        "a@x.org",
        "not-an-email",
      ].join("\n"),
    );
    expect(entries.map((e) => e.email)).toEqual(["a@x.org", "b@x.org", "c@x.org", "d@x.org", "e@x.org", "f@x.org"]);
    // A legacy third "Subteam" column is ignored.
    expect(entries[1]).toEqual({ email: "b@x.org", name: "Bee Bop" });
    expect(entries[2].name).toBe("Cee Dee");
    expect(invalid).toEqual(["not-an-email"]);
  });
});
