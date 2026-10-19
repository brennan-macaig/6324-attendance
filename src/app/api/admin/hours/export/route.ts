import type { NextRequest } from "next/server";
import { db } from "@/db";
import type { Role } from "@/db/schema";
import { authzErrorResponse, requireRole } from "@/lib/authz";
import { env } from "@/lib/env";
import { resolveSeason, seasonReport } from "@/lib/queries";
import { parseSort, seasonCsv, sortRows } from "@/lib/report";
import { runSweep } from "@/lib/sweep";
import { isoDateInTz } from "@/lib/time";

/** GET /api/admin/hours/export?season=<id>&who=students|all&sort=&dir=  (mentor+) */
export async function GET(req: NextRequest) {
  try {
    await requireRole("mentor");
  } catch (err) {
    return authzErrorResponse(err);
  }
  const sp = req.nextUrl.searchParams;
  const { season } = await resolveSeason(db, sp.get("season"));
  if (!season) return Response.json({ error: "No season" }, { status: 404 });
  const roles: Role[] = sp.get("who") === "all" ? ["student", "mentor", "admin"] : ["student"];
  const { key, dir } = parseSort(sp.get("sort"), sp.get("dir"));
  await runSweep();
  const report = await seasonReport(db, season.id, { roles, cutoff: env.dailyCutoff });
  const tz = env.teamTimezone;
  const csv = seasonCsv(sortRows(report.rows, key, dir), report.meetingsHeld, (d) => (d ? isoDateInTz(d, tz) : ""), {
    hoursTarget: season.hoursTarget,
  });
  const filename = `hours-${season.name.replace(/[^A-Za-z0-9_-]+/g, "_")}-${isoDateInTz(new Date(), tz)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
