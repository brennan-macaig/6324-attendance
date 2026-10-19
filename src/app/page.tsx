import { redirect } from "next/navigation";
import { QrCode } from "lucide-react";
import { getCurrentUser, homeFor, safeRedirectPath } from "@/lib/authz";
import { BrandMark } from "@/components/nav-bar";
import { GoogleSignIn } from "@/components/ui";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const callbackUrl = safeRedirectPath(typeof sp.callbackUrl === "string" ? sp.callbackUrl : null, "/");
  const user = await getCurrentUser();
  if (user) redirect(callbackUrl !== "/" ? callbackUrl : homeFor(user));

  const team = process.env.TEAM_NAME || "FRC Team";
  const domain = process.env.ALLOWED_EMAIL_DOMAIN;
  return (
    <div className="animate-fade-in-up mx-auto flex max-w-sm flex-col items-center pt-6 text-center sm:pt-16">
      <BrandMark size={52} />
      <h1 className="mt-6 text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] sm:text-[2rem]">{team}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
        Check in at meetings and keep track of your hours.
        {domain ? (
          <>
            {" "}
            Use your <span className="font-medium text-ink">@{domain}</span> account.
          </>
        ) : null}
      </p>
      <div className="mt-8 w-full rounded-panel border border-line bg-surface p-5 shadow-card">
        <GoogleSignIn callbackUrl={callbackUrl} size="xl" />
      </div>
      <div className="mt-6 flex items-start gap-3 rounded-card px-2 text-left text-[13px] leading-relaxed text-ink-3">
        <QrCode className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>At a meeting? Scan the QR code on the kiosk screen with your phone camera to check in.</span>
      </div>
    </div>
  );
}
