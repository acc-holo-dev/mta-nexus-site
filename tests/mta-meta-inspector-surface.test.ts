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

    expect(page).toContain("<MtaMetaInspectorPanel />");
    expect(page.indexOf("<MtaMetaInspectorPanel />")).toBeLessThan(
      page.indexOf("<form onSubmit={submit}"),
    );
    expect(panel).toContain('type="button"');
    expect(panel).toContain('fetch("/api/resources/inspect-meta"');
    expect(panel).not.toContain("/api/products/");
    expect(panel).not.toContain("buildForm");
  });

  it("states that inspection is structural rather than a security scan", () => {
    const panel = read(
      "apps/web/src/components/mta-meta-inspector-panel.tsx",
    );

    expect(panel).toContain("does not scan the build archive");
    expect(panel).toContain("does not produce a security verdict");
    expect(panel).toContain("Structural notes");
    expect(panel).not.toContain("Resource is safe");
    expect(panel).not.toContain("Verified resource");
  });

  it("keeps a client-side size check in addition to the server limit", () => {
    const panel = read(
      "apps/web/src/components/mta-meta-inspector-panel.tsx",
    );

    expect(panel).toContain("const MAX_META_BYTES = 256 * 1024");
    expect(panel).toContain("file.size > MAX_META_BYTES");
    expect(panel).toContain('accept=".xml,text/xml,text/plain"');
  });
});
