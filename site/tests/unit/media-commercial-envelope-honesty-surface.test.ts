import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Waves 282–286: shared media/commercial helpers must emit remapped error with code. */
describe("media/commercial additive error envelope honesty", () => {
  it.each([
    ["site/src/features/resources/resource-media-upload-http.ts", "resourceMediaError"],
    ["site/src/features/resources/resource-media-image-http.ts", "resourceMediaError"],
    ["site/src/features/commerce/commercial-public-http.ts", "commercialError"],
  ])("%s wires %s and forbids message passthrough", (path, remapper) => {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    expect(source).toContain(remapper);
    expect(source).toContain("resolveLocale");
    expect(source).not.toMatch(/error:\s*(?:error|appError)\.message/);
    expect(source).not.toMatch(/\{\s*code:\s*error\.code\s*\}/);
  });
});
