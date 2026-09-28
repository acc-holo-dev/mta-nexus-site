import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasExpectedBuildFileFormat } from "../apps/web/src/lib/build-file-validation";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("build file format detection", () => {
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
      "utf8"
    );

    expect(route).toContain("hasExpectedBuildFileFormat");
    expect(route).toContain("Build content does not match its file extension");
    expect(route).toContain("const fileBytes = new Uint8Array(await file.arrayBuffer())");
    expect(route).toContain("BUILD_MIME_TYPES");
    expect(route).toContain("path.basename(file.name)");
    expect(route).toContain("fileName: safeFileName");
  });
});
