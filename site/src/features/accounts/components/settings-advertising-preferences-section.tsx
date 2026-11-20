"use client";

import { BellOff } from "lucide-react";
import { useCallback, useState } from "react";
import { useNexusLocale } from "../../shell/locale";
import { panelSpace4P5Shadow } from "../../shell/panel-shell";
import {
  typeBlockSmPrimary,
  typeCaptionFaint,
  typeFlexCenterGap2,
  typeFlexCursorBetweenGap4Py3,
  typeIconAccent,
  typeMt05BlockXsMuted,
  typeSmSemiboldPrimary,
  typeXsMuted,
} from "../../shell/type-shell";
import { type AdPreference, adPreferenceCookie, parseAdPreference } from "../ad-preference";
import { adsPreferencesCopy } from "../ads-preferences-i18n";

/**
 * UX-26 -- advertising opt-out preference on /settings.
 *
 * Honest-scope surface: stores only the user's cookie preference for whether
 * sponsored placements may be shown. It performs no behavioral profiling and
 * never influences organic score/order, reviews, popularity or trust. It does
 * not create observed events by itself. No public serve path renders a slot
 * until a separate activation gate enables a renderer with a real serve-route,
 * which the settings UI states honestly. This component is rendered in the
 * settings page only while the advertising lifecycle feature flag is on.
 */
export function SettingsAdvertisingPreferencesSection({
  rendererEnabled,
}: {
  /** Public SponsoredPlacementSlot renderer switch (off by default, UX-25 part A). */
  rendererEnabled: boolean;
}) {
  const { locale } = useNexusLocale();
  const copy = adsPreferencesCopy(locale);
  const [preference, setPreference] = useState<AdPreference>(() => {
    if (typeof document === "undefined") return "in";
    return parseAdPreference(document.cookie.match(/nexus_ad_opt_out=([^;]*)/)?.[1]);
  });

  const toggle = useCallback(() => {
    const next: AdPreference = preference === "out" ? "in" : "out";
    // biome-ignore lint/suspicious/noDocumentCookie: non-sensitive SameSite=Lax preference before refresh.
    document.cookie = adPreferenceCookie(next);
    setPreference(next);
  }, [preference]);

  const toggleLabel = preference === "out" ? copy.deny : copy.allow;
  const status = preference === "out" ? copy.statusDenied : copy.statusAllowed;
  const offLine = rendererEnabled ? copy.rendererOn : copy.rendererOff;

  return (
    <section aria-labelledby="advertising-preferences-heading" className={panelSpace4P5Shadow}>
      <div className={typeFlexCenterGap2}>
        <BellOff className={typeIconAccent} aria-hidden="true" />
        <h2 id="advertising-preferences-heading" className={typeSmSemiboldPrimary}>
          {copy.heading}
        </h2>
      </div>
      <p className={typeXsMuted}>{copy.description}</p>
      <div className={typeFlexCursorBetweenGap4Py3}>
        <span>
          <span className={typeBlockSmPrimary}>{toggleLabel}</span>
          <span className={typeMt05BlockXsMuted}>{status}</span>
        </span>
        <input
          type="checkbox"
          checked={preference === "in"}
          onChange={() => toggle()}
          aria-label={toggleLabel}
          className={`h-4 w-4 accent-[var(--nexus-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]`}
        />
      </div>
      <p className={typeCaptionFaint}>{offLine}</p>
    </section>
  );
}
