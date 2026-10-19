import Link from "next/link";
import { Lock } from "lucide-react";
import { buttonClass } from "@/components/button-class";
import { StatusPage } from "@/components/status-page";

export default function ForbiddenPage() {
  return (
    <StatusPage icon={<Lock className="size-6" aria-hidden />} title="Not allowed" body="You don't have permission to view that page.">
      <Link href="/" className={buttonClass("primary", "lg")}>
        Go home
      </Link>
    </StatusPage>
  );
}
