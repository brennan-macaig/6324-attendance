"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";
import type { ActionState } from "@/lib/actions";
import type { Theme } from "@/db/schema";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Click a swatch to apply it immediately (submits the form, no separate Save button). */
export function ThemePicker({
  action,
  current,
  options,
}: {
  action: Action;
  current: Theme;
  options: { id: Theme; label: string; swatch: string }[];
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((o) => {
          const selected = o.id === current;
          return (
            <button
              key={o.id}
              type="submit"
              name="theme"
              value={o.id}
              aria-pressed={selected}
              className={`flex items-center gap-3 rounded-card border px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                selected ? "border-accent ring-1 ring-inset ring-accent" : "border-line hover:border-line-strong hover:bg-surface-hover"
              }`}
            >
              <span
                className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-black/10"
                style={{ backgroundColor: o.swatch }}
              >
                {selected ? <Check className="size-4 text-white" aria-hidden /> : null}
              </span>
              <span className="text-sm font-medium text-ink">{o.label}</span>
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className={state ? `mt-3 text-[13px] font-medium ${state.ok ? "text-success-ink" : "text-danger-ink"}` : "sr-only"}>
        {state?.message ?? ""}
      </p>
    </form>
  );
}
