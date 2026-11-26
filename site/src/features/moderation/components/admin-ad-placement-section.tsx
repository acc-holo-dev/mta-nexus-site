import type { AdSlotPlan } from "@nexus/domain";
import { EmptyState, ErrorState, SectionHeader, StatusBadge } from "@nexus/ui";
import Link from "next/link";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { linkAccentSmRounded } from "../../shell/link-shell";
import {
  typeBreakSemiboldPrimary,
  typeCaptionFaint,
  typeCaptionMuted,
  typeFlexShrinkCenterGap2,
} from "../../shell/type-shell";
import { adminAdPlacementCopy } from "../admin-ad-placement-i18n";

/**
 * UX-24 -- admin overview of the (feature-flagged) advertising placement
 * lifecycle. Read-only inventory listing: slots, capacity, and active bookings.
 * Management actions and any exposure to production visitors or payments remain
 * behind the NEXT_PUBLIC_ADVERTISING_LIFECYCLE switch and a separate activation
 * gate. When disabled the section does not render at all.
 *
 * `slots === null` is a load failure (ErrorState + retry). An empty array is a
 * real empty inventory (EmptyState) — never treat those as the same outcome.
 */

type SlotSummary = {
  slot: AdSlotPlan;
  pending: number;
  active: number;
};

function slotLabel(slot: AdSlotPlan): string {
  return slot.name || slot.positionKey;
}

export function AdminAdPlacementSection({
  locale,
  slots,
  rendererEnabled,
  retryHref,
}: {
  locale: Locale;
  /** `null` = inventory load failed (not an empty inventory). */
  slots: readonly SlotSummary[] | null;
  /** Public SponsoredPlacementSlot renderer switch (off by default, UX-25 part A). */
  rendererEnabled: boolean;
  retryHref: string;
}) {
  const copy = adminAdPlacementCopy(locale);
  const dictionary = getDictionary(locale);
  return (
    <section>
      <SectionHeader title={copy.title} description={copy.description} />
      {slots === null ? (
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={retryHref} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      ) : slots.length === 0 ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : (
        <ul className="space-y-3">
          {slots.map(({ slot, pending, active }) => (
            <li
              key={slot.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-base p-3"
            >
              <div className="min-w-0">
                <p className={typeBreakSemiboldPrimary}>{slotLabel(slot)}</p>
                <p className={typeCaptionMuted}>
                  {copy.positionCapacity(slot.positionKey, slot.capacity)}
                </p>
              </div>
              <div className={typeFlexShrinkCenterGap2}>
                {pending > 0 && <StatusBadge tone="warning" status={copy.pending(pending)} />}
                <StatusBadge
                  tone={active > 0 ? "success" : "neutral"}
                  status={copy.active(active)}
                />
              </div>
            </li>
          ))}
          <li className={typeCaptionFaint}>
            {copy.enabledTotal(slots.filter((s) => s.slot.enabled).length)}
          </li>
          <li className={typeCaptionFaint}>
            {rendererEnabled ? copy.rendererOn : copy.rendererOff}
          </li>
        </ul>
      )}
    </section>
  );
}
