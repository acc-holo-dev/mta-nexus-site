import { cn } from "./utils";

export type FieldSize = "md" | "compact";

export type FieldControlOptions = {
  size?: FieldSize;
  error?: boolean;
  pending?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Shared native control chrome for filter selects/inputs outside the labeled
 * `<Input>` / `<Field>` components. Keep layout variants (w-full, min-h-11) at call sites.
 */
export const fieldClass =
  "rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";

/** Full-width field used by most platform and filter forms. */
export const fieldClassBlock = `w-full ${fieldClass}`;

const sizeClass: Record<FieldSize, string> = {
  md: "h-10 px-3 py-2 text-sm",
  compact: "h-8 px-2.5 py-1.5 text-xs",
};

/** State-aware chrome for native input/select/textarea sharing Input geometry. */
export function fieldControlClass({
  size = "md",
  error = false,
  pending = false,
  readOnly = false,
  disabled = false,
  className,
}: FieldControlOptions = {}) {
  return cn(
    "w-full rounded-lg border bg-inset text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]",
    sizeClass[size],
    error ? "border-[color:var(--nexus-danger)]" : "border-base hover:border-strong",
    disabled && "cursor-not-allowed opacity-60",
    readOnly && !disabled && "border-dashed bg-surface text-secondary",
    pending && !disabled && "opacity-80",
    className,
  );
}
