import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { buildModerationUiState } from "../apps/web/src/lib/build-moderation-ui";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({
    locale: "en",
    dictionary: getDictionary("en"),
  }),
}));

import { BuildModerationControls } from "../apps/web/src/components/build-moderation-controls";

describe("build moderation control behavior", () => {
  it("requires review notes and trusted clean provenance before approval", () => {
    expect(
      buildModerationUiState({
        scanStatus: "clean",
        hasScanProvenance: true,
        notes: "ok",
        pending: null,
      }),
    ).toEqual({
      hasNotes: false,
      hasTrustedCleanScan: true,
      canApprove: false,
      canReject: false,
    });

    expect(
      buildModerationUiState({
        scanStatus: "clean",
        hasScanProvenance: true,
        notes: "Reviewed clean artifact",
        pending: null,
      }),
    ).toEqual({
      hasNotes: true,
      hasTrustedCleanScan: true,
      canApprove: true,
      canReject: true,
    });

    expect(
      buildModerationUiState({
        scanStatus: "not_scanned",
        hasScanProvenance: false,
        notes: "Reject incomplete evidence",
        pending: null,
      }),
    ).toMatchObject({
      hasTrustedCleanScan: false,
      canApprove: false,
      canReject: true,
    });
  });

  it("disables both moderation actions while another decision is pending", () => {
    expect(
      buildModerationUiState({
        scanStatus: "clean",
        hasScanProvenance: true,
        notes: "Reviewed clean artifact",
        pending: "approve",
      }),
    ).toMatchObject({
      canApprove: false,
      canReject: false,
    });
  });

  it("renders reviewer download only for provenance-backed clean builds", () => {
    const copy = getDictionary("en").admin;
    const trusted = renderToStaticMarkup(
      <BuildModerationControls buildId="bld_clean" scanStatus="clean" hasScanProvenance />,
    );
    expect(trusted).toContain('href="/api/admin/builds/bld_clean/download"');
    expect(trusted).toContain(copy.reviewArtifact);
    expect(trusted).not.toContain(copy.artifactRequiresCleanScan);

    const untrusted = renderToStaticMarkup(
      <BuildModerationControls
        buildId="bld_unknown"
        scanStatus="not_scanned"
        hasScanProvenance={false}
      />,
    );
    expect(untrusted).not.toContain('href="/api/admin/builds/bld_unknown/download"');
    expect(untrusted).toContain(copy.artifactRequiresCleanScan);
  });
});
