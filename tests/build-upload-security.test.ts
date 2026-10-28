import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  exceedsBuildFileSizeLimit,
  getSupportedBuildExtension,
  validateBuildFileSelection,
  hasExpectedBuildFileFormat,
  MAX_BUILD_FILE_SIZE_BYTES,
} from "../apps/web/src/lib/build-file-validation";
import { MAX_BUILD_MULTIPART_OVERHEAD_BYTES, MAX_UPLOAD_FILE_SIZE_BYTES } from "@nexus/domain";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("build file format detection", () => {
  it.each([
    ["resource.zip", "zip"],
    ["resource.RAR", "rar"],
    ["resource.7z", "7z"],
    ["resource.lua", "lua"],
  ])("recognizes supported build extension %s", (fileName, expected) => {
    expect(getSupportedBuildExtension(fileName)).toBe(expected);
  });

  it.each(["resource.tar.gz", "resource.zip.exe", "resource.exe"])(
    "rejects unsupported build extension %s",
    (fileName) => expect(getSupportedBuildExtension(fileName)).toBeNull(),
  );

  it("rejects invalid file selections before any upload orchestration", () => {
    expect(validateBuildFileSelection(null)).toBe("missing");
    expect(
      validateBuildFileSelection({
        name: "empty.zip",
        size: 0,
      }),
    ).toBe("missing");
    expect(
      validateBuildFileSelection({
        name: "oversized.exe",
        size: MAX_BUILD_FILE_SIZE_BYTES + 1,
      }),
    ).toBe("too_large");
    expect(
      validateBuildFileSelection({
        name: "resource.exe",
        size: 1024,
      }),
    ).toBe("unsupported_type");
    expect(
      validateBuildFileSelection({
        name: "resource.zip",
        size: MAX_BUILD_FILE_SIZE_BYTES,
      }),
    ).toBeNull();
  });

  it("matches the storage limit and rejects oversized uploads", () => {
    const storage = readFileSync(
      resolve(process.cwd(), "packages/storage/src/storage-service.ts"),
      "utf8",
    );
    expect(storage).toContain("MAX_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_BYTES");
    expect(exceedsBuildFileSizeLimit(MAX_BUILD_FILE_SIZE_BYTES)).toBe(false);
    expect(exceedsBuildFileSizeLimit(MAX_BUILD_FILE_SIZE_BYTES + 1)).toBe(true);
  });

  it("keeps the reverse proxy headroom aligned with the multipart upload envelope", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/[id]/builds/route.ts"),
      "utf8",
    );
    const caddy = readFileSync(resolve(process.cwd(), "deploy/Caddyfile"), "utf8");
    const proxyLimit = caddy.match(/request_body\s*\{[^}]*max_size\s+(\d+)/u);

    expect(route).toContain("MAX_BUILD_MULTIPART_OVERHEAD_BYTES");
    expect(proxyLimit).not.toBeNull();
    expect(Number(proxyLimit?.[1])).toBe(
      MAX_UPLOAD_FILE_SIZE_BYTES + MAX_BUILD_MULTIPART_OVERHEAD_BYTES,
    );
  });

  it.each([
    ["zip", bytes(0x50, 0x4b, 0x03, 0x04, 0x00)],
    ["zip", bytes(0x50, 0x4b, 0x05, 0x06)],
    ["zip", bytes(0x50, 0x4b, 0x07, 0x08)],
    ["rar", bytes(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00)],
    ["rar", bytes(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00)],
    ["7z", bytes(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)],
    ["lua", new TextEncoder().encode("-- resource script\nprint('hello')")],
  ])("accepts a recognized %s marker", (extension, content) => {
    expect(hasExpectedBuildFileFormat(extension, content)).toBe(true);
  });

  it.each([
    ["zip", bytes(0x50, 0x4b)],
    ["zip", bytes(0x50, 0x4b, 0x01, 0x02)],
    ["rar", bytes(0x52, 0x61, 0x72, 0x21)],
    ["rar", bytes(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x02)],
    ["7z", bytes(0x37, 0x7a, 0xbc, 0xaf, 0x27)],
    ["lua", bytes(0x70, 0x72, 0x69, 0x6e, 0x74, 0x00, 0x28)],
    ["lua", bytes(0xff, 0xfe, 0xfd)],
    ["exe", bytes(0x4d, 0x5a)],
  ])("rejects a mismatched or truncated %s upload", (extension, content) => {
    expect(hasExpectedBuildFileFormat(extension, content)).toBe(false);
  });
});

describe("build upload hardening", () => {
  it("checks archive signatures before storage", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/[id]/builds/route.ts"),
      "utf8",
    );

    expect(route).toContain("hasExpectedBuildFileFormat");
    expect(route).toContain("Build content does not match its file extension");
    expect(route).toContain("const fileBytes = new Uint8Array(await file.arrayBuffer())");
    expect(route).toContain("BUILD_MIME_TYPES");
    expect(route).toContain("BUILD_FILE_SIZE_LIMIT_MB");
    expect(route).toContain("path.basename(file.name)");
    expect(route).toContain("fileName: safeFileName");
  });
});
