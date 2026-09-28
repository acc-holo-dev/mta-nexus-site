import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("author-facing MTA meta inspector", () => {
  it("is optional and separate from the build submission form", () => {
    const page = read(
      "apps/web/src/app/workspace/resources/new/page.tsx",
    );
    const panel = read(
      "apps/web/src/components/mta-meta-inspector-panel.tsx",
    );

    expect(page).toContain("<MtaMetaInspectorPanel");
    expect(page.indexOf("<MtaMetaInspectorPanel")).toBeLessThan(
      page.indexOf("<form"),
    );
    expect(panel).toContain('type="button"');
    expect(panel).toContain('fetch("/api/resources/inspect-meta"');
    expect(panel).not.toContain("/api/products/");
    expect(panel).not.toContain("buildForm");
  });

  it("states through localized copy that inspection is structural rather than a security scan", () => {
    const panel = read(
      "apps/web/src/components/mta-meta-inspector-panel.tsx",
    );

    expect(panel).toContain("dictionary.metaInspector");
    expect(panel).toContain("copy.description");
    expect(panel).toContain("copy.structuralNotes");
    expect(panel).toContain("copy.note");
    expect(panel).toContain("getMtaVersionTargetSuggestion");
    expect(panel).toContain("copy.applyMinimumVersion");
    expect(panel).not.toContain("Resource is safe");
    expect(panel).not.toContain("Verified resource");
  });

  it("connects the inspector suggestion to the controlled MTA target field", () => {
    const page = read("apps/web/src/app/workspace/resources/new/page.tsx");
    const panel = read("apps/web/src/components/mta-meta-inspector-panel.tsx");

    expect(page).toContain("onApplyMinimumVersion={setMtaVersionTarget}");
    expect(page).toContain("value={mtaVersionTarget}");
    expect(panel).toContain("onApplyMinimumVersion(versionSuggestion)");
  });

  it("keeps client size and authenticated uncached request guards", () => {
    const panel = read(
      "apps/web/src/components/mta-meta-inspector-panel.tsx",
    );

    expect(panel).toContain("const MAX_META_BYTES = 256 * 1024");
    expect(panel).toContain("file.size > MAX_META_BYTES");
    expect(panel).toContain('accept=".xml,text/xml,text/plain"');
    expect(panel).toContain('credentials: "same-origin"');
    expect(panel).toContain('cache: "no-store"');
    expect(panel).toContain("AbortSignal.timeout(10_000)");
  });
});
