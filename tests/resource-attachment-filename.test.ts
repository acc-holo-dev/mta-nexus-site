import { describe, expect, it } from "vitest";
import {
  resourceAttachmentFileName,
  reviewerAttachmentFileName,
} from "../apps/web/src/lib/resource-attachment-filename";

describe("safe download response filenames", () => {
  it("keeps ordinary release filenames and allowlisted extensions", () => {
    expect(resourceAttachmentFileName("script", "1.2.3", "asset.zip")).toBe("script-1.2.3.zip");
    expect(resourceAttachmentFileName("script", "1.2.3", "asset.lua")).toBe("script-1.2.3.lua");
    for (const ext of [
      ".luac",
      ".dff",
      ".txd",
      ".col",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".json",
      ".map",
    ]) {
      expect(resourceAttachmentFileName("script", "1.2.3", `asset${ext}`)).toBe(
        `script-1.2.3${ext}`,
      );
    }
    expect(resourceAttachmentFileName("script", "1.2.3", "IMAGE.PNG")).toBe("script-1.2.3.png");
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

// Evidence downloads must also sanitize the persisted build ID. Unlike
// public release filenames, reviewers need to preserve artifact extensions.
describe("reviewer evidence attachment filenames", () => {
  it("keeps the expected ordinary reviewer attachment name", () => {
    expect(reviewerAttachmentFileName("bld_abc123", "asset.zip")).toBe(
      "review-bld_abc123-asset.zip",
    );
  });

  it("protects header syntax against hostile IDs and either path separator", () => {
    for (const value of [
      'bld_"\r\nX-Injected: yes',
      "../outside",
      "C:\\temp\\evil",
      "привет",
      "..",
      "a".repeat(600),
    ]) {
      const name = reviewerAttachmentFileName(value, value);
      expect(name).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,198}$/u);
      expect(name.length).toBeLessThanOrEqual(200);
      expect(name).not.toMatch(/[\r\n"\\/]/u);
      expect(name).not.toContain("..");
    }
  });

  it("uses a stable inert fallback for absent metadata", () => {
    expect(reviewerAttachmentFileName("", "")).toBe("review-build-artifact.bin");
    expect(reviewerAttachmentFileName("bld_abc", "C:\\secret\\files\\mod.exe")).toBe(
      "review-bld_abc-mod.exe",
    );
  });
});
