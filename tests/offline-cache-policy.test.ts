import { describe, expect, it } from "vitest";
import {
  appendVaryHeader,
  isOfflineCacheablePublicPath,
} from "../apps/web/src/lib/offline-cache-policy";

describe("public offline cache policy", () => {
  it("allows only the intentionally small read-only surface", () => {
    for (const path of [
      "/articles",
      "/articles/release-notes",
      "/articles/a-b",
      "/privacy",
      "/terms",
      "/copyright",
    ]) {
      expect(isOfflineCacheablePublicPath(path)).toBe(true);
    }

    for (const path of [
      "/",
      "/market",
      "/market/paid-resource",
      "/checkout",
      "/settings",
      "/security",
      "/workspace",
      "/notifications",
      "/support",
      "/servers",
      "/articles/a",
      "/articles/nested/path",
      "/articles/%2e%2e",
    ]) {
      expect(isOfflineCacheablePublicPath(path)).toBe(false);
    }
  });

  it("adds Cookie to Vary without duplicating existing fields", () => {
    expect(appendVaryHeader(null, "Cookie")).toBe("Cookie");
    expect(appendVaryHeader("RSC, Accept-Encoding", "Cookie")).toBe("RSC, Accept-Encoding, Cookie");
    expect(appendVaryHeader("RSC, cookie, Accept-Encoding", "Cookie")).toBe(
      "RSC, cookie, Accept-Encoding",
    );
  });
});
