import Link from "next/link";
import { ShieldX } from "lucide-react";
import { buttonClass } from "@/components/button-class";
import { StatusPage } from "@/components/status-page";

const MESSAGES: Record<string, string> = {
  domain: "That Google account isn't allowed. Please sign in with your school account.",
  roster: "Your email isn't on the team roster yet. Ask a mentor or admin to add you.",
  inactive: "Your account has been deactivated. Talk to a mentor if this is a mistake.",
  unverified: "Your Google account email isn't verified.",
  AccessDenied: "Sign-in was denied.",
  Configuration: "Sign-in isn't configured correctly on the server. Tell an admin.",
};

export default async function AuthErrorPage({ searchParams }: PageProps<"/auth-error">) {
  const sp = await searchParams;
  const reason = typeof sp.reason === "string" ? sp.reason : typeof sp.error === "string" ? sp.error : "";
  return (
    <StatusPage icon={<ShieldX className="size-6" aria-hidden />} title="Couldn't sign you in" body={MESSAGES[reason] ?? "Something went wrong during sign-in."}>
      <Link href="/" className={buttonClass("primary", "lg")}>
        Try again
      </Link>
    </StatusPage>
  );
}
