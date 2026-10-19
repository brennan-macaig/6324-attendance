import Link from "next/link";
import { cookies } from "next/headers";
import { CalendarX2, CircleCheck, Clock, MoonStar, QrCode, ScanLine, TimerOff } from "lucide-react";
import { db } from "@/db";
import { getCheckin, getMeeting, statusOf } from "@/lib/attendance";
import { getCurrentUser } from "@/lib/authz";
import { isPastCutoff } from "@/lib/cutoff";
import { env } from "@/lib/env";
import { checkinDurationMs, elapsedMs, formatDuration } from "@/lib/hours";
import { firstName } from "@/lib/names";
import { readScanProof, SCAN_PROOF_COOKIE, SCAN_PROOF_TTL_SECONDS } from "@/lib/scan-proof";
import { runSweep } from "@/lib/sweep";
import { formatTime } from "@/lib/time";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { buttonClass } from "@/components/button-class";
import { GoogleSignIn } from "@/components/ui";
import { scanCheckInAction, scanCheckOutAction } from "../actions";

export const metadata = { title: "Check in" };

type Tone = "success" | "accent" | "warning" | "neutral" | "danger";

export default async function ConfirmPage({ searchParams }: PageProps<"/checkin/confirm">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const tz = env.teamTimezone;
  const cutoff = env.dailyCutoff;
  const jar = await cookies();
  const proof = readScanProof(env.checkinSecret, jar.get(SCAN_PROOF_COOKIE)?.value);
  const user = await getCurrentUser();

  if (error) {
    return (
      <Shell>
        <Panel
          tone="warning"
          icon={<TimerOff />}
          title={error === "expired" ? "That QR code expired" : "That link isn't valid"}
          body="The kiosk code changes every 30 seconds. Please scan the code on the screen again."
        />
        {user ? <BackToMe /> : null}
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        {proof ? (
          <Panel
            tone="success"
            icon={<CircleCheck />}
            title="Scan received"
            body={`Sign in with Google to finish checking in. Your scan is good for ${Math.round(SCAN_PROOF_TTL_SECONDS / 60)} minutes.`}
          >
            <GoogleSignIn callbackUrl="/checkin/confirm" size="xl" />
          </Panel>
        ) : (
          <Panel tone="accent" icon={<QrCode />} title="Sign in" body="Scan the QR code on the kiosk to check in, then sign in with Google.">
            <GoogleSignIn callbackUrl="/checkin/confirm" size="xl" />
          </Panel>
        )}
      </Shell>
    );
  }

  await runSweep();
  const meeting = proof ? await getMeeting(db, proof.m) : null;
  const checkin = meeting ? await getCheckin(db, user.id, meeting.id) : null;
  const status = statusOf(checkin);
  const name = firstName(user);
  const now = new Date();

  if (!proof || !meeting) {
    return (
      <Shell>
        <Panel
          tone="neutral"
          icon={<ScanLine />}
          title={`Hi ${name}`}
          body={proof ? "That meeting no longer exists." : "No recent scan found. Scan the QR code on the kiosk to check in or out."}
        />
        <BackToMe />
      </Shell>
    );
  }

  if (status === "not_checked_in" && isPastCutoff(now, cutoff)) {
    return (
      <Shell>
        <Panel tone="accent" icon={<MoonStar />} title="Check-in is closed for today" body={`Thanks for stopping by, ${name}. Check-in reopens at the next meeting.`} />
        <BackToMe />
      </Shell>
    );
  }

  if (!meeting.isOpen) {
    return (
      <Shell>
        <Panel tone="neutral" icon={<CalendarX2 />} title="This meeting is closed" body="Ask a mentor if you need your attendance fixed." />
        <BackToMe />
      </Shell>
    );
  }

  return (
    <Shell>
      {status === "not_checked_in" ? (
        <Panel tone="success" icon={<ScanLine />} eyebrow={user.email} title={`Check in, ${name}?`} body="Tap the button to record your attendance for today's meeting.">
          <ActionForm action={scanCheckInAction} className="space-y-3 text-center" messageClassName="text-[15px]">
            <input type="hidden" name="meetingId" value={meeting.id} />
            <SubmitButton variant="success" size="xl" pendingText="Checking in…">
              Check in
            </SubmitButton>
          </ActionForm>
        </Panel>
      ) : status === "checked_in" ? (
        <Panel
          tone="success"
          icon={<Clock />}
          eyebrow={user.email}
          title="You're checked in"
          body={
            <>
              Since <span className="tabular font-medium text-ink">{formatTime(checkin!.checkedInAt, tz)}</span> · {formatDuration(elapsedMs(checkin!.checkedInAt))} so far
            </>
          }
        >
          <ActionForm action={scanCheckOutAction} className="space-y-3 text-center" messageClassName="text-[15px]">
            <input type="hidden" name="meetingId" value={meeting.id} />
            <SubmitButton variant="primary" size="xl" pendingText="Checking out…">
              Check out now
            </SubmitButton>
          </ActionForm>
          <Link href="/me" className={`${buttonClass("ghost", "xl")} mt-2`}>
            Stay checked in
          </Link>
        </Panel>
      ) : (
        <Panel
          tone="neutral"
          icon={<CircleCheck />}
          title="You've checked out"
          body={
            <>
              <span className="tabular">
                {formatTime(checkin!.checkedInAt, tz)} – {formatTime(checkin!.checkedOutAt, tz)}
              </span>{" "}
              ({formatDuration(checkinDurationMs(checkin!.checkedInAt, checkin!.checkedOutAt, cutoff))}). Ask a mentor if this is wrong.
            </>
          }
        />
      )}
      {status !== "checked_in" ? <BackToMe /> : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in-up mx-auto max-w-md space-y-5 pt-2 sm:pt-8">{children}</div>;
}

const iconTone: Record<Tone, string> = {
  success: "bg-success-soft text-success-ink ring-success-line",
  accent: "bg-accent-soft text-accent-ink ring-brand-200 dark:ring-brand-800",
  warning: "bg-warning-soft text-warning-ink ring-warning-line",
  neutral: "bg-surface-2 text-ink-3 ring-line",
  danger: "bg-danger-soft text-danger-ink ring-danger-line",
};

function Panel({
  tone,
  icon,
  eyebrow,
  title,
  body,
  children,
}: {
  tone: Tone;
  icon: React.ReactNode;
  eyebrow?: string;
  title: string;
  body: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-panel border border-line bg-surface px-5 pb-5 pt-7 text-center shadow-card sm:px-7">
      <div className={`mx-auto flex size-14 items-center justify-center rounded-full ring-1 ring-inset [&>svg]:size-7 ${iconTone[tone]}`} aria-hidden>
        {icon}
      </div>
      {eyebrow ? <p className="mt-4 truncate text-[13px] text-ink-3">{eyebrow}</p> : null}
      <h1 className={`${eyebrow ? "mt-1" : "mt-4"} text-[1.625rem] font-semibold leading-tight tracking-[-0.02em]`}>{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-ink-2">{body}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}

function BackToMe() {
  return (
    <Link href="/me" className={`${buttonClass("ghost", "lg")} w-full`}>
      Go to my attendance
    </Link>
  );
}
