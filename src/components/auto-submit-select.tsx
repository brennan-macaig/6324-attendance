"use client";

import type { ComponentProps } from "react";

/** <select> that submits its (GET) form on change. Works without JS via a submit button next to it. */
export function AutoSubmitSelect(props: ComponentProps<"select">) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
