import { buildResourcePublicationReadiness } from "@nexus/domain";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResourcePublicationReadinessPanel } from "../../site/src/components/resource-publication-readiness-panel";
import {
  getResourcePublicationReadinessCopy,
  publicationReadinessDetail,
} from "../../site/src/lib/resource-publication-readiness-i18n";
import { getResourcePublisherCopy } from "../../site/src/lib/resource-publisher-i18n";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href }, children),
  };
});

const baseInput = {
  productId: "prd_test",
  productStatus: "draft" as const,
  metadataReviewRequired: false,
  title: "ab",
  description: "too short",
  shortDescription: "",
  hasCompatibilityMetadata: false,
  mediaCount: 0,
  submitCandidate: null,
  latestBuild: null,
};

describe("ResourcePublicationReadinessPanel", () => {
  it.each(["en", "ru"] as const)(
    "surfaces concrete checklist reasons and fix links instead of empty shell copy in %s",
    (locale) => {
      const summary = buildResourcePublicationReadiness(baseInput);
      const panelCopy = getResourcePublicationReadinessCopy(locale);
      const publisherCopy = getResourcePublisherCopy(locale);
      const html = renderToStaticMarkup(
        createElement(ResourcePublicationReadinessPanel, {
          locale,
          previewHref: "/market/demo-resource",
          summary,
        }),
      );

      expect(html).toContain(panelCopy.title);
      expect(html).toContain(
        `${panelCopy.overview}: ${publisherCopy.readiness[summary.inventoryReadiness]}`,
      );

      for (const item of summary.items) {
        const detail = publicationReadinessDetail(locale, item);
        expect(detail.length).toBeGreaterThan(12);
        expect(html).toContain(detail);
        expect(html).toContain(panelCopy.items[item.id]);
        expect(html).toContain(`href="${item.actionPath}"`);
        expect(html).toContain(panelCopy.fix);
      }

      expect(html).toContain(panelCopy.checklistNote);
      expect(html).toContain(panelCopy.previewNote);
      expect(html).toContain('href="/market/demo-resource"');
      expect(html).toContain('aria-labelledby="publication-readiness-heading"');
    },
  );

  it("shows blocked scan and build guidance with distinct EN and RU detail strings", () => {
    const summary = buildResourcePublicationReadiness({
      ...baseInput,
      title: "Ready title",
      description: "Long enough description for save.",
      latestBuild: {
        id: "bld_a",
        version: "1.0.0",
        status: "testing",
        scanStatus: "malicious",
        scanner: "scanner-a",
        scannedAt: "2026-10-01T00:00:00.000Z",
      },
    });
    const scanItem = summary.items.find((item) => item.id === "scan");
    expect(scanItem).toBeDefined();
    if (!scanItem) throw new Error("expected scan readiness item");
    expect(scanItem.detailKey).toBe("malicious");

    const enHtml = renderToStaticMarkup(
      createElement(ResourcePublicationReadinessPanel, {
        locale: "en",
        previewHref: "/market/demo",
        summary,
      }),
    );
    const ruHtml = renderToStaticMarkup(
      createElement(ResourcePublicationReadinessPanel, {
        locale: "ru",
        previewHref: "/market/demo",
        summary,
      }),
    );

    const enDetail = publicationReadinessDetail("en", scanItem);
    const ruDetail = publicationReadinessDetail("ru", scanItem);
    expect(enDetail).not.toBe(ruDetail);
    expect(enHtml).toContain(enDetail);
    expect(ruHtml).toContain(ruDetail);
    expect(enDetail.toLowerCase()).toContain("malware");
  });
});
