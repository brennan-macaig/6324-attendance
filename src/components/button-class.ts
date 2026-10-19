/**
 * Button styles, shared by <button>, <a> and <Link>. All colors come from the
 * design tokens in globals.css.
 */
const variants = {
  primary: "bg-accent text-white shadow-xs hover:bg-accent-hover active:bg-brand-800",
  secondary: "bg-surface text-ink shadow-xs ring-1 ring-inset ring-line-strong hover:bg-surface-hover",
  ghost: "text-ink-2 hover:bg-surface-hover hover:text-ink",
  danger: "bg-danger text-white shadow-xs hover:bg-danger-hover",
  "danger-soft": "bg-surface text-danger-ink shadow-xs ring-1 ring-inset ring-danger-line hover:bg-danger-soft",
  success: "bg-success-solid text-white shadow-xs hover:bg-success-solid-hover",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] rounded-control",
  md: "h-9 px-3.5 text-sm rounded-control",
  lg: "h-11 px-5 text-[15px] rounded-[10px]",
  xl: "h-14 w-full px-6 text-lg rounded-card",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return `inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,box-shadow,color,transform] duration-150 active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-60 ${variants[variant]} ${sizes[size]}`;
}
