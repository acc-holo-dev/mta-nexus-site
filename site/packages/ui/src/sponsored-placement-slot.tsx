import { TrustBadge } from "./platform";
import { cn } from "./utils";

/* ============================================================
   SponsoredPlacementSlot — UX-25 ad-slot renderer.

   Reserved advertising slot renderer. The slot is a separate,
   read-only region and never wraps organic results: it renders no
   product/server card, no reviews, no popularity data and never
   changes organic score/order/trust. Failing states (no-fill,
   error, expired, ineligible) must leave the surrounding page fully
   functional: by default they render NOTHING (zero DOM => zero layout
   shift, zero interaction). When a fixed geometry is required for a
   late-loaded slot, the consumer passes `slotHeight` so the reserved
   space is bounded and never pushes an interactive control unpredictably.
   ============================================================ */

export type SponsoredPlacementFillState = "fill" | "no-fill" | "error" | "expired" | "ineligible";

export interface SponsoredPlacementTarget {
  targetType: "product" | "server";
  id: string;
  title: string;
  href: string;
  description?: string;
  /** Advertiser display name; defaults to the localized "advertiser" label. */
  advertiserName?: string;
}

export interface SponsoredPlacementSlotProps {
  /** A served placement. null means no placement is available. */
  placement?: SponsoredPlacementTarget | null;
  /** Explicit serve outcome. Defaults to "fill" when a placement is present. */
  state?: SponsoredPlacementFillState;
  locale?: "ru" | "en";
  className?: string;
  /**
   * Fixed height in px reserved for this slot on late-load so content does
   * not displace a primary action under the user's finger. Only the fill
   * state renders inside it; non-fill states keep the reserved geometry
   * inert (no interactive controls, no visible ad).
   */
  slotHeight?: number;
}

const SPONSORED_LABEL: Record<"ru" | "en", string> = {
  ru: "Реклама",
  en: "Sponsored",
};

const ADVERTISER_LABEL: Record<"ru" | "en", string> = {
  ru: "Рекламодатель",
  en: "Advertiser",
};

const DEFAULT_SLOT_HEIGHT = 120;

/**
 * Resolved renderer behavior for each serve state.
 *  - fill:         visible marked slot with a link.
 *  - no-fill:      no placement served -> nothing.
 *  - error:        serve/load failed -> nothing (page stays usable).
 *  - expired:      window closed before render -> nothing.
 *  - ineligible:   target disqualified at render time -> nothing, integrity preserved.
 */
const NON_FILL_STATES: ReadonlySet<SponsoredPlacementFillState> = new Set([
  "no-fill",
  "error",
  "expired",
  "ineligible",
]);

export function SponsoredPlacementSlot({
  placement,
  state = "fill",
  locale = "ru",
  className,
  slotHeight,
}: SponsoredPlacementSlotProps) {
  if (!placement || NON_FILL_STATES.has(state)) {
    // Hard guarantee: failing states emit no interactive controls and, unless
    // the consumer explicitly reserves geometry, no DOM at all.
    if (!slotHeight) return null;
    return (
      <div
        aria-hidden="true"
        className={cn("pointer-events-none select-none", className)}
        style={{ height: slotHeight }}
        data-sponsored-slot-reserved=""
      />
    );
  }

  const ariaLabel =
    locale === "ru" ? `Реклама. ${placement.title}` : `Sponsored. ${placement.title}`;
  const slot = slotHeight ?? DEFAULT_SLOT_HEIGHT;

  return (
    <section
      aria-label={ariaLabel}
      className={cn("nexus-panel relative flex items-center overflow-hidden p-4", className)}
      style={{ minHeight: slot }}
      data-sponsored-slot-state="fill"
    >
      <span className="sr-only">{SPONSORED_LABEL[locale]}</span>
      <a
        href={placement.href}
        data-sponsored-target-type={placement.targetType}
        data-sponsored-target-id={placement.id}
        className="flex w-full flex-col gap-1.5 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        <span className="flex flex-wrap items-center gap-2">
          <TrustBadge variant="sponsored" label={SPONSORED_LABEL[locale]} />
          <span className="font-caption text-faint">
            {ADVERTISER_LABEL[locale]}
            {placement.advertiserName ? `: ${placement.advertiserName}` : ""}
          </span>
        </span>
        <span className="font-heading text-primary">{placement.title}</span>
        {placement.description ? (
          <span className="font-caption text-muted">{placement.description}</span>
        ) : null}
      </a>
    </section>
  );
}
