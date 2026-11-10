import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SponsoredPlacementSlot } from "@nexus/ui";

const placement = {
  targetType: "product" as const,
  id: "p1",
  title: "Promoted Resource",
  href: "/resources/p1",
  description: "A described sponsored target.",
  advertiserName: "Example Studio",
};

describe("SponsoredPlacementSlot (UX-25 renderer)", () => {
  it("marks the fill state clearly in EN before any click", () => {
    const html = renderToStaticMarkup(
      createElement(SponsoredPlacementSlot, { placement, locale: "en" }),
    );
    expect(html).toContain("Sponsored");
    expect(html).toContain("Advertiser: Example Studio");
    expect(html).toContain('href="/resources/p1"');
    expect(html).toMatch(/<section\b/);
    expect(html).toContain('aria-label="Sponsored. Promoted Resource"');
    expect(html).toContain('data-sponsored-target-id="p1"');
  });

  it("marks the fill state clearly in RU before any click", () => {
    const html = renderToStaticMarkup(
      createElement(SponsoredPlacementSlot, { placement, locale: "ru" }),
    );
    expect(html).toContain("Реклама");
    expect(html).toContain("Рекламодатель: Example Studio");
    expect(html).toContain('aria-label="Реклама. Promoted Resource"');
  });

  it("does not imply trust, clean build or any organic quality signal", () => {
    const html = renderToStaticMarkup(
      createElement(SponsoredPlacementSlot, { placement, locale: "en" }),
    );
    // Sponsored never promises identity, clean build or verified quality.
    for (const forbidden of ["Verified", "Verified Developer", "Clean Build", "Official"]) {
      expect(html).not.toContain(forbidden);
    }
  });

  it("emits nothing for failing states when no geometry is reserved", () => {
    for (const state of ["no-fill", "error", "expired", "ineligible"] as const) {
      const html = renderToStaticMarkup(
        createElement(SponsoredPlacementSlot, { placement, state, locale: "en" }),
      );
      expect(html).toBe("");
    }
    // No placement at all behaves like no-fill.
    expect(
      renderToStaticMarkup(
        createElement(SponsoredPlacementSlot, { placement: null, locale: "en" }),
      ),
    ).toBe("");
  });

  it("keeps a reserved slot inert (no link, no visible ad) on failing states", () => {
    for (const state of ["no-fill", "error", "expired", "ineligible"] as const) {
      const html = renderToStaticMarkup(
        createElement(SponsoredPlacementSlot, {
          placement,
          state,
          locale: "en",
          slotHeight: 120,
        }),
      );
      expect(html).toContain('data-sponsored-slot-reserved=""');
      expect(html).toContain("aria-hidden");
      expect(html).toContain("pointer-events-none");
      expect(html).not.toMatch(/<a\b/);
      expect(html).not.toContain("Спонсор");
    }
  });

  it("never renders any organic or paid-trust card into the slot", () => {
    // The slot only carries marking + title + advertiser label.
    const html = renderToStaticMarkup(
      createElement(SponsoredPlacementSlot, { placement, locale: "ru" }),
    );
    expect(html).not.toContain("Отзывы");
    expect(html).not.toContain("популяр");
    expect(html).not.toContain("infinite");
  });
});
