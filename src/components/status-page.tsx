import type { ReactNode } from "react";

/** Centered single-message page (errors, forbidden). */
export function StatusPage({ icon, title, body, children }: { icon: ReactNode; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="animate-fade-in-up mx-auto max-w-sm pt-6 text-center sm:pt-16">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger-ink ring-1 ring-danger-line">{icon}</div>
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
      <div className="mt-8 flex justify-center">{children}</div>
    </div>
  );
}
