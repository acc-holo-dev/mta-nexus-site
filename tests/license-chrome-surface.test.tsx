import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getLicenseControlCopy } from "../apps/web/src/lib/license-control-i18n";
import { getLicenseMaintenanceCopy } from "../apps/web/src/lib/license-maintenance-i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href }, children),
  };
});
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { LicenseArchiveFilters } from "../apps/web/src/components/license-archive-filters";
import { LicenseControlPanel } from "../apps/web/src/components/license-control-panel";

describe("license chrome surface", () => {
  it.each(["en", "ru"] as const)(
    "applies archive filters with shared Button chrome in %s",
    (locale) => {
      const copy = getLicenseMaintenanceCopy(locale);
      const html = renderToStaticMarkup(
        createElement(LicenseArchiveFilters, {
          locale,
          page: 1,
          query: {
            page: 1,
            q: "",
            status: "all",
            binding: "all",
            term: "all",
            sort: "newest",
          },
        }),
      );
      expect(html).toContain(copy.apply);
      expect(html).toContain("rounded-lg");
      expect(html).toContain("text-accent");
      expect(html).toContain('type="submit"');
    },
  );

  it("renders license control actions with shared Button chrome", () => {
    const copy = getLicenseControlCopy("en");
    const html = renderToStaticMarkup(
      createElement(LicenseControlPanel, {
        license: {
          id: "lic_a",
          status: "active",
          effectiveStatus: "active",
          updatedAt: "2026-10-10T00:00:00.000Z",
          canActivate: true,
          bindingReady: true,
          boundServerId: null,
          expiresAt: "2027-01-01T00:00:00.000Z",
        },
        initialServers: {
          servers: [{ id: "srv_a", name: "Server A" }],
          page: 1,
          totalPages: 2,
        },
      }),
    );
    expect(html).toContain(copy.submit);
    expect(html).toContain(copy.previous);
    expect(html).toContain(copy.next);
    expect(html).toContain(copy.refresh);
    expect(html).toContain("rounded-lg");
    expect(html).toContain("bg-accent");
  });
});
