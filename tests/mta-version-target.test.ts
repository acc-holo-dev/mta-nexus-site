import { describe, expect, it } from "vitest";
import { getMtaVersionTargetSuggestion } from "../apps/web/src/lib/mta-version-target";

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
    expect(
      getMtaVersionTargetSuggestion({ client: null, server: "1.6.0", both: null }),
    ).toBe("1.6.0");
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
});
