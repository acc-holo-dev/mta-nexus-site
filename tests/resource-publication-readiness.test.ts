import {
  buildResourcePublicationReadiness,
  hasTrustedCleanScan,
} from "@nexus/domain";
import { describe, expect, it } from "vitest";

const baseInput = {
  productId: "prd_test",
  productStatus: "draft" as const,
  metadataReviewRequired: false,
  title: "Demo resource",
  description: "Long enough description for save.",
  shortDescription: "Summary",
  hasCompatibilityMetadata: false,
  mediaCount: 0,
  submitCandidate: null,
  latestBuild: null,
};

describe("resource publication readiness", () => {
  it("marks compatibility and media as recommendations only", () => {
    const summary = buildResourcePublicationReadiness(baseInput);
    expect(summary.items.find((item) => item.id === "compatibility")?.tier).toBe(
      "recommendation",
    );
    expect(summary.items.find((item) => item.id === "media")?.tier).toBe("recommendation");
    expect(summary.items.find((item) => item.id === "description")?.tier).toBe("required");
  });

  it("requires trusted clean scan evidence before submit", () => {
    const build = {
      id: "bld_a",
      version: "1.0.0",
      status: "draft" as const,
      scanStatus: "clean" as const,
      scanner: "scanner-a",
      scannedAt: "2026-10-01T00:00:00.000Z",
    };
    expect(hasTrustedCleanScan(build)).toBe(true);
    const ready = buildResourcePublicationReadiness({
      ...baseInput,
      submitCandidate: build,
      latestBuild: build,
    });
    expect(ready.canSubmitForReview).toBe(true);
    expect(ready.inventoryReadiness).toBe("ready");

    const pending = buildResourcePublicationReadiness({
      ...baseInput,
      latestBuild: { ...build, scanStatus: "not_scanned", scanner: null, scannedAt: null },
    });
    expect(pending.canSubmitForReview).toBe(false);
    expect(pending.items.find((item) => item.id === "scan")?.state).toBe("pending");
  });

  it("does not treat missing compatibility as a blocker", () => {
    const summary = buildResourcePublicationReadiness({
      ...baseInput,
      latestBuild: {
        id: "bld_a",
        version: "1.0.0",
        status: "testing",
        scanStatus: "not_scanned",
        scanner: null,
        scannedAt: null,
      },
    });
    const compatibility = summary.items.find((item) => item.id === "compatibility");
    expect(compatibility?.state).toBe("pending");
    expect(compatibility?.tier).toBe("recommendation");
  });

  it("reflects moderation queue and restricted product states", () => {
    const inReview = buildResourcePublicationReadiness({
      ...baseInput,
      productStatus: "pending_review",
      latestBuild: {
        id: "bld_a",
        version: "1.0.0",
        status: "pending_review",
        scanStatus: "clean",
        scanner: "scanner-a",
        scannedAt: "2026-10-01T00:00:00.000Z",
      },
    });
    expect(inReview.items.find((item) => item.id === "moderation")?.detailKey).toBe("in_review");

    const restricted = buildResourcePublicationReadiness({
      ...baseInput,
      productStatus: "archived",
    });
    expect(restricted.inventoryReadiness).toBe("restricted");
    expect(restricted.items.find((item) => item.id === "moderation")?.state).toBe("blocked");
  });
});
