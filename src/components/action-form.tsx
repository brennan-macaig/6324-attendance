"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/actions";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button-class";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Form wrapper for server actions that return ActionState. Shows the result
 * message (aria-live) and optionally asks for confirmation first.
 */
export function ActionForm({
  action,
  children,
  className,
  confirm,
  resetOnSuccess,
  messageClassName,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
  messageClassName?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <p
        aria-live="polite"
        className={state ? `${messageClassName ?? "text-[13px]"} font-medium ${state.ok ? "text-success-ink" : "text-danger-ink"}` : "sr-only"}
      >
        {state?.message ?? ""}
      </p>
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  pendingText,
  name,
  value,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  pendingText?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, size)} name={name} value={value}>
      {pending ? (
        <>
          <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent opacity-80" aria-hidden />
          {pendingText ?? "Working…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}
