import { expect, it } from "vitest";
import {
  RESOURCE_CONTENT_LENGTH_HEADER,
  resolveResourceDownloadContentLength,
} from "../../src/features/resources/resource-download-headers";

it("prefers Content-Length when present", () => {
  const headers = new Headers({
    "Content-Length": "64",
    [RESOURCE_CONTENT_LENGTH_HEADER]: "128",
  });
  expect(resolveResourceDownloadContentLength(headers)).toBe("64");
});

it("falls back to X-Resource-Content-Length when Content-Length is stripped", () => {
  const headers = new Headers({
    [RESOURCE_CONTENT_LENGTH_HEADER]: "67108864",
  });
  expect(resolveResourceDownloadContentLength(headers)).toBe("67108864");
});

it("returns null when neither size header is present", () => {
  expect(resolveResourceDownloadContentLength(new Headers())).toBeNull();
});
