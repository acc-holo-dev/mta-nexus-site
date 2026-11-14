"use client";

import { BellOff } from "lucide-react";
import { useCallback, useState } from "react";
import { type AdPreference, adPreferenceCookie, parseAdPreference } from "../lib/ad-preference";
import { useNexusLocale } from "./locale-context";

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

  const heading = locale === "ru" ? "Реклама и показ" : "Advertising and placements";
  const description =
    locale === "ru"
      ? "Настройка касается только гипотетических sponsored-показов и не меняет органический score, порядок, отзывы, популярность или доверие. Никакого поведенческого профилирования."
      : "This preference affects only prospective sponsored placements and never changes organic score, order, reviews, popularity or trust. No behavioral profiling.";
  const offLine =
    locale === "ru"
      ? rendererEnabled
        ? "Публичный рендер слота включён; предпочтение будет учитываться serve-путём."
        : "Публичный рендер слота выключен (по умолчанию). Предпочтение сохраняется, но видимых sponsored-показов пока нет."
      : rendererEnabled
        ? "Public slot renderer enabled; the preference will be honored by the serve path."
        : "Public slot renderer is off (default). The preference is stored, but no sponsored placements are currently shown.";
  const toggleLabel =
    locale === "ru"
      ? preference === "out"
        ? "Не показывать sponsored-размещения"
        : "Разрешить shown: включено сейчас"
      : preference === "out"
        ? "Do not show sponsored placements"
        : "Allow sponsored placements: enabled now";
  const status =
    locale === "ru"
      ? preference === "out"
        ? "Отказано (opt-out по умолчанию сохраняется)"
        : "Разрешено"
      : preference === "out"
        ? "Opted out (default stays opted-out)"
        : "Allowed";

  return (
    <section
      aria-labelledby="advertising-preferences-heading"
      className="nexus-panel space-y-4 p-5 shadow-nexus-sm"
    >
      <div className="flex items-center gap-2">
        <BellOff className="h-4 w-4 text-accent" aria-hidden="true" />
        <h2 id="advertising-preferences-heading" className="text-sm font-semibold text-primary">
          {heading}
        </h2>
      </div>
      <p className="text-xs text-muted">{description}</p>
      <div className="flex cursor-pointer items-center justify-between gap-4 py-3">
        <span>
          <span className="block text-sm text-primary">{toggleLabel}</span>
          <span className="mt-0.5 block text-xs text-muted">{status}</span>
        </span>
        <input
          type="checkbox"
          checked={preference === "in"}
          onChange={() => toggle()}
          aria-label={toggleLabel}
          className={`h-4 w-4 accent-[var(--nexus-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]`}
        />
      </div>
      <p className="font-caption text-faint">{offLine}</p>
    </section>
  );
}
