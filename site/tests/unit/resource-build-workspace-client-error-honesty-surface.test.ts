import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getResourceBuildWorkspaceCopy,
  resourceBuildWorkspaceError,
} from "../../src/features/resources/resource-build-workspace-i18n";

/** Waves 202–204: version workspace + build moderation prefer code remappers. */
describe("resourceBuildWorkspaceError honesty surface", () => {
  it("maps revision/state conflicts without English code passthrough", () => {
    for (const locale of ["en", "ru"] as const) {
      const copy = getResourceBuildWorkspaceCopy(locale);
      expect(resourceBuildWorkspaceError(locale, "BUILD_REVISION_CONFLICT")).toBe(copy.conflict);
      expect(resourceBuildWorkspaceError(locale, "CONFLICT")).toBe(copy.conflict);
      expect(resourceBuildWorkspaceError(locale, "BUILD_COMMAND_INVALID")).toBe(copy.failed);
      expect(resourceBuildWorkspaceError(locale, "RATE_LIMIT_EXCEEDED")).toBe(copy.failed);
      expect(resourceBuildWorkspaceError(locale, "UNKNOWN_CODE")).toBe(copy.failed);
    }
    expect(resourceBuildWorkspaceError("en", "CONFLICT")).not.toEqual(
      resourceBuildWorkspaceError("ru", "CONFLICT"),
    );
  });

  it("wires build controls and staff moderation onto remappers", () => {
    const buildControls = readFileSync(
      resolve(process.cwd(), "site/src/features/resources/components/resource-build-controls.tsx"),
      "utf8",
    );
    const moderation = readFileSync(
      resolve(
        process.cwd(),
        "site/src/features/resources/components/build-moderation-controls.tsx",
      ),
      "utf8",
    );
    expect(buildControls).toContain("resourceBuildWorkspaceError");
    expect(moderation).toContain("adminActionClientError");
    expect(buildControls).not.toMatch(/setMessage\(response\.status === 409/);
    expect(moderation).not.toMatch(/setError\(response\.status === 409/);
  });
});
