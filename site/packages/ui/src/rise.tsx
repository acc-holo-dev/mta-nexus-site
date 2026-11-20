import type { HTMLAttributes } from "react";
import { cn } from "./utils";

export type RiseDelay = "none" | "short" | "medium" | "long";

const delayClass: Record<RiseDelay, string> = {
  none: "motion-safe:animate-[nexus-rise_520ms_var(--nexus-ease-out)_both]",
  short: "motion-safe:animate-[nexus-rise_560ms_var(--nexus-ease-out)_80ms_both]",
  medium: "motion-safe:animate-[nexus-rise_620ms_var(--nexus-ease-out)_160ms_both]",
  long: "motion-safe:animate-[nexus-rise_700ms_var(--nexus-ease-out)_240ms_both]",
};

export interface RiseProps extends HTMLAttributes<HTMLDivElement> {
  delay?: RiseDelay;
  asChild?: never;
}

/** Presence motion for hero/shell hierarchy; respects prefers-reduced-motion via motion-safe. */
export function Rise({ delay = "none", className, ...rest }: RiseProps) {
  return <div className={cn(delayClass[delay], className)} {...rest} />;
}
