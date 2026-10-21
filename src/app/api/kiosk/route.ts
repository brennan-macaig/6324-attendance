import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { db } from "@/db";
import { getMeeting } from "@/lib/attendance";
import { authzErrorResponse, requireRole } from "@/lib/authz";
import { buildCheckinUrl, generateToken, windowEndsAt, windowFor } from "@/lib/checkin-token";
import { env } from "@/lib/env";
import { displayName } from "@/lib/names";
import { meetingAttendees } from "@/lib/queries";
import { runSweep } from "@/lib/sweep";

/**
 * GET /api/kiosk?m=<meetingId>  (mentor/admin only)
 * Returns the current rotating QR (as SVG) and the live attendee list.
 * Polled by the kiosk page every few seconds — no WebSockets needed.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("mentor");
  } catch (err) {
    return authzErrorResponse(err);
  }
  const parsed = z.uuid().safeParse(req.nextUrl.searchParams.get("m"));
  if (!parsed.success) return Response.json({ error: "Bad meeting id" }, { status: 400 });

  await runSweep();
  const meeting = await getMeeting(db, parsed.data);
  if (!meeting) return Response.json({ error: "Meeting not found" }, { status: 404 });
  if (!meeting.isOpen) return Response.json({ closed: true }, { headers: { "Cache-Control": "no-store" } });

  const now = Date.now();
  const token = generateToken(env.checkinSecret, meeting.id, now);
  const url = buildCheckinUrl(env.appUrl ?? req.nextUrl.origin, meeting.id, token);
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  const attendees = await meetingAttendees(db, meeting.id);

  return Response.json(
    {
      closed: false,
      token,
      qrSvg: svg,
      windowEndsAt: windowEndsAt(windowFor(now)),
      serverNow: now,
      attendees: attendees.map((a) => ({
        id: a.user.id,
        // Students: "First L." only — the kiosk is a public screen.
        name: displayName(a.user),
        image: a.user.image,
        role: a.user.role,
        checkedInAt: a.checkin.checkedInAt.toISOString(),
        checkedOutAt: a.checkin.checkedOutAt?.toISOString() ?? null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
