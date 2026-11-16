import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { getDictionary } from "../../src/lib/i18n";

const state = vi.hoisted(() => ({ locale: "en" as "en" | "ru" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("../../src/components/locale-context", () => ({
  useNexusLocale: () => ({
    locale: state.locale,
    dictionary: getDictionary(state.locale),
  }),
}));

import { AdminBuildsQuarantineSection } from "../../src/components/admin/admin-builds-quarantine-section";

it.each(["en", "ru"] as const)(
  "renders admin builds quarantine actionable links with min-h-11 touch targets in %s",
  (locale) => {
    state.locale = locale;
    const copy = getDictionary(locale).admin;
    const html = renderToStaticMarkup(
      <AdminBuildsQuarantineSection
        locale={locale}
        copy={copy}
        dateLocale={locale === "ru" ? "ru-RU" : "en-US"}
        buildPage={2}
        pendingBuildCount={1}
        pendingBuilds={[
          {
            id: "bld_pending",
            fileName: "mod.zip",
            version: "1.0.0",
            productId: "prd_1",
            fileSizeBytes: 2_097_152,
            productStatus: "published",
            productSlug: "demo-mod",
            productTitle: "Demo Mod",
            publisherUsername: "author",
            scanStatus: "clean",
            sha256Hash: "abc123",
            scanner: "clamav",
            scannedAt: "2026-01-01T00:00:00.000Z",
            releaseNotes: "notes",
          },
        ]}
        moreBuilds
        riskBuildPage={2}
        quarantinedBuildCount={1}
        riskBuilds={[
          {
            id: "bld_risk",
            fileName: "risk.zip",
            version: "2.0.0",
            status: "quarantined",
            productStatus: "published",
            productSlug: "risk-mod",
            productTitle: "Risk Mod",
            publisherUsername: "publisher",
            scanStatus: "clean",
            sha256Hash: "def456",
            quarantineReason: "manual hold for review",
            quarantinedAt: "2026-01-02T00:00:00.000Z",
            scanner: "clamav",
            scannedAt: "2026-01-01T12:00:00.000Z",
          },
        ]}
        moreRiskBuilds
        adminHref={(changes) => {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(changes)) {
            params.set(key, String(value));
          }
          return `/admin?${params.toString()}`;
        }}
      />,
    );

    expect(html).toContain("inline-flex min-h-11 items-center");
    expect(html).toContain('href="/market/demo-mod"');
    expect(html).toContain('href="/users/author"');
    expect(html).toContain('href="/admin/resources/prd_1/builds/bld_pending"');
    expect(html).toContain('href="/api/admin/builds/bld_risk/download"');
    expect(html).toContain(copy.previous);
    expect(html).toContain(copy.next);
    expect(html).toContain(copy.reviewArtifact);

    const touchLinkMatches = html.match(/inline-flex min-h-11 items-center/g) ?? [];
    expect(touchLinkMatches.length).toBeGreaterThanOrEqual(8);
  },
);
