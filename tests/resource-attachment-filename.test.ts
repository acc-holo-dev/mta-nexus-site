import { describe, expect, it } from "vitest";
import { resourceAttachmentFileName } from "../apps/web/src/lib/resource-attachment-filename";

describe("safe download response filenames", () => {
  it("keeps ordinary release filenames and allowlisted extensions", () => {
    expect(resourceAttachmentFileName("script", "1.2.3", "asset.zip")).toBe("script-1.2.3.zip");
    expect(resourceAttachmentFileName("script", "1.2.3", "asset.lua")).toBe("script-1.2.3.lua");
  });
  it("does not allow header delimiters, Unicode, quotes, or traversal text", () => {
    for (const value of ['unsafe"\r\nX-Injected: yes', "../escape", "привет", "a\\b"]) {
      const result = resourceAttachmentFileName(value, value, "asset.exe");
      expect(result).toMatch(/^[a-zA-Z0-9._-]+\.zip$/u);
      expect(result).not.toMatch(/[\r\n"\\/]/u);
      expect(result.length).toBeLessThanOrEqual(200);
      expect(result).not.toContain("..");
    }
  });
  it("bounds long metadata and uses fallback values", () => {
    const name = resourceAttachmentFileName("x".repeat(700), "v".repeat(500), "payload.7z");
    expect(name.length).toBeLessThanOrEqual(200);
    expect(name.endsWith(".7z")).toBe(true);
    expect(resourceAttachmentFileName("", "", "payload.exe")).toBe("resource-release.zip");
  });
});
