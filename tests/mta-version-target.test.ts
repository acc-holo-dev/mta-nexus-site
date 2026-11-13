import { describe, expect, it } from "vitest";
import {
  compareResourceVersions,
  isValidResourceVersion,
  resourceVersionsConflict,
} from "@nexus/domain";
import { MTA_VERSION_PATTERN } from "@nexus/validation";
import { getMtaVersionTargetSuggestion } from "../site/src/lib/mta-version-target";

describe("MTA minimum version suggestions", () => {
  it("preserves the exact shared sortable release value", () => {
    expect(
      getMtaVersionTargetSuggestion({
        client: null,
        server: null,
        both: "1.6.0-9.22279.0",
      }),
    ).toBe("1.6.0-9.22279.0");
  });

  it("uses a single or matching side-specific minimum", () => {
    expect(getMtaVersionTargetSuggestion({ client: null, server: "1.6.0", both: null })).toBe(
      "1.6.0",
    );
    expect(
      getMtaVersionTargetSuggestion({
        client: "1.6.0-9.22279.0",
        server: "1.6.0-9.22279.0",
        both: null,
      }),
    ).toBe("1.6.0-9.22279.0");
  });

  it("does not collapse different client and server requirements", () => {
    expect(
      getMtaVersionTargetSuggestion({
        client: "1.5.9",
        server: "1.6.0",
        both: null,
      }),
    ).toBeNull();
  });

  it("ignores malformed version values", () => {
    expect(
      getMtaVersionTargetSuggestion({
        client: null,
        server: null,
        both: "1.6.0-preview",
      }),
    ).toBeNull();
    expect(getMtaVersionTargetSuggestion(null)).toBeNull();
  });

  it("keeps MTA compatibility targets in a separate field from human resource versions", () => {
    const mtaTarget = "1.6.0-9.22279.0";
    const resourceVersion = "2.0.0";
    expect(MTA_VERSION_PATTERN.test(mtaTarget)).toBe(true);
    // Human resource versions are not constrained to MTA's `1.x` sortable form.
    expect(MTA_VERSION_PATTERN.test(resourceVersion)).toBe(false);
    expect(isValidResourceVersion(resourceVersion)).toBe(true);
    // OPS-19: fields stay separate even if some strings could parse under both helpers.
    expect(resourceVersionsConflict(resourceVersion, mtaTarget)).toBe(false);
    expect(compareResourceVersions(resourceVersion, "v2.0.0")).toBe(0);
    expect(getMtaVersionTargetSuggestion({ client: null, server: null, both: mtaTarget })).toBe(
      mtaTarget,
    );
  });
});
