"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { checkIn, checkOut, getOpenMeeting } from "@/lib/attendance";
import { requireRole } from "@/lib/authz";
import { clientIpFromHeaders } from "@/lib/cidr";
import { cookieBase, DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE, isValidDeviceId, newDeviceId } from "@/lib/device";
import { env } from "@/lib/env";
import { fail, guard, ok, revalidateAll, type ActionState } from "@/lib/actions";
import { readScanProof, SCAN_PROOF_COOKIE } from "@/lib/scan-proof";
import { runSweep } from "@/lib/sweep";
import { formatTime } from "@/lib/time";

const MeetingForm = z.object({ meetingId: z.uuid() });

async function deviceId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(DEVICE_COOKIE)?.value;
  if (isValidDeviceId(existing)) return existing;
  const id = newDeviceId();
  jar.set(DEVICE_COOKIE, id, { ...cookieBase, maxAge: DEVICE_COOKIE_MAX_AGE });
  return id;
}

/** Check-in REQUIRES a valid scan proof for this meeting (from GET /checkin). */
export async function scanCheckInAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireRole("student");
    const { meetingId } = MeetingForm.parse({ meetingId: fd.get("meetingId") });
    const jar = await cookies();
    const proof = readScanProof(env.checkinSecret, jar.get(SCAN_PROOF_COOKIE)?.value);
    if (!proof || proof.m !== meetingId) {
      return fail("Your scan has expired. Please scan the QR code on the kiosk again.");
    }
    const h = await headers();
    await runSweep();
    const result = await checkIn(db, {
      studentId: user.id,
      meetingId,
      ip: clientIpFromHeaders(h),
      deviceId: await deviceId(),
      schoolIpRanges: env.schoolIpRanges,
      cutoff: env.dailyCutoff,
    });
    // One scan == one action.
    jar.delete(SCAN_PROOF_COOKIE);
    revalidateAll();
    switch (result.status) {
      case "checked_in":
      case "already_checked_in":
        // Proof is consumed; show the result on the student's page.
        redirect("/me?done=in");
      case "already_checked_out":
        return fail("You already checked out of this meeting. Ask a mentor if this is a mistake.");
      case "past_cutoff":
        return fail("Check-in is closed for today. See you next meeting!");
      case "meeting_closed":
        return fail("This meeting has been closed.");
      case "no_meeting":
        return fail("That meeting doesn't exist.");
    }
  });
}

/** Check-out via a fresh scan (no extra flag). */
export async function scanCheckOutAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireRole("student");
    const { meetingId } = MeetingForm.parse({ meetingId: fd.get("meetingId") });
    const jar = await cookies();
    const proof = readScanProof(env.checkinSecret, jar.get(SCAN_PROOF_COOKIE)?.value);
    const viaScan = !!proof && proof.m === meetingId;
    await runSweep();
    const result = await checkOut(db, { studentId: user.id, meetingId, viaScan });
    if (viaScan) jar.delete(SCAN_PROOF_COOKIE);
    revalidateAll();
    if (result.status === "checked_out") redirect("/me?done=out");
    return checkoutMessage(result.status, null);
  });
}

/**
 * Check-out from the student's own /me page without scanning. Allowed by
 * design (see README "Security model"); flagged `self_checkout`.
 */
export async function selfCheckOutAction(): Promise<ActionState> {
  return guard(async () => {
    const user = await requireRole("student");
    await runSweep();
    const meeting = await getOpenMeeting(db);
    if (!meeting) return fail("There's no open meeting.");
    const result = await checkOut(db, { studentId: user.id, meetingId: meeting.id, viaScan: false });
    revalidateAll();
    if (result.status === "checked_out") redirect("/me?done=out");
    return checkoutMessage(result.status, null);
  });
}

function checkoutMessage(status: string, at: Date | null): ActionState {
  switch (status) {
    case "checked_out":
      return ok(`Checked out at ${formatTime(at, env.teamTimezone)}.`);
    case "already_checked_out":
      return ok("You're already checked out.");
    case "not_checked_in":
      return fail("You aren't checked in to this meeting.");
    default:
      return fail("This meeting has been closed.");
  }
}
