import type { HTMLAttributes } from "react";
import { cn } from "./utils";

export type BrandMarkSize = "sm" | "md";

export interface BrandMarkProps extends HTMLAttributes<HTMLElement> {
  href?: string | null;
  size?: BrandMarkSize;
  showWordmark?: boolean;
  /** Extra classes for the wordmark span (e.g. responsive visibility). */
  wordmarkClassName?: string;
}

const tileBySize: Record<BrandMarkSize, string> = {
  sm: "h-6 w-6 rounded text-[10px] font-bold",
  md: "h-8 w-8 rounded-lg text-xs font-black shadow-nexus-sm",
};

const wordmarkBySize: Record<BrandMarkSize, string> = {
  sm: "font-heading text-primary",
  md: "text-sm font-bold text-primary",
};

/**
 * Shared NX tile + optional wordmark for shell chrome.
 * Renders `<a>` when `href` is set; otherwise a non-interactive span.
 * Linked marks always expose a single accessible name so responsive
 * CSS that hides the wordmark cannot leave an empty link.
 */
export function BrandMark({
  href = "/",
  size = "md",
  showWordmark = true,
  wordmarkClassName,
  className,
  ...rest
}: BrandMarkProps) {
  const tile = (
    <span
      className={cn(
        "inline-flex items-center justify-center bg-accent text-white",
        tileBySize[size],
      )}
    >
      NX
    </span>
  );
  const mark = (
    <>
      {tile}
      {showWordmark ? (
        <span className={cn(wordmarkBySize[size], wordmarkClassName)}>MTA NEXUS</span>
      ) : null}
    </>
  );
  const classes = cn(
    "inline-flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]",
    className,
  );

  if (href) {
    return (
      <a href={href} className={classes} {...rest} aria-label="MTA NEXUS">
        <span className="inline-flex items-center gap-2" aria-hidden="true">
          {mark}
        </span>
      </a>
    );
  }

  if (showWordmark) {
    return (
      <span className={classes} {...rest}>
        {mark}
      </span>
    );
  }

  return (
    <span className={classes} role="img" aria-label="MTA NEXUS" {...rest}>
      <span className="inline-flex items-center gap-2" aria-hidden="true">
        {mark}
      </span>
    </span>
  );
}
