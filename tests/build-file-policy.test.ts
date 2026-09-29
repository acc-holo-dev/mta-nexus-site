import { describe, expect, it } from "vitest";
import {
  getBuildFileValidationError,
  getSupportedBuildExtension,
  MAX_BUILD_FILE_SIZE_BYTES,
} from "../apps/web/src/lib/build-file-policy";

describe("build file policy", () => {
  it.each([
    ["resource.zip", "zip"],
    ["resource.RAR", "rar"],
    ["resource.7z", "7z"],
    ["resource.lua", "lua"],
  ])("recognizes supported extension %s", (fileName, expected) => {
    expect(getSupportedBuildExtension(fileName)).toBe(expected);
  });

  it("rejects unsupported extensions and misleading suffixes", () => {
    expect(getSupportedBuildExtension("resource.tar.gz")).toBeNull();
    expect(getSupportedBuildExtension("resource.zip.exe")).toBeNull();
  });

  it("accepts a non-empty supported file at the exact size limit", () => {
    expect(getBuildFileValidationError({
      name: "resource.zip",
      size: MAX_BUILD_FILE_SIZE_BYTES,
    })).toBeNull();
  });

  it("explains missing, empty, unsupported and oversized selections", () => {
    expect(getBuildFileValidationError(null)).toBe("Choose a build archive");
    expect(getBuildFileValidationError({ name: "resource.zip", size: 0 })).toBe("Choose a build archive");
    expect(getBuildFileValidationError({ name: "resource.exe", size: 1 })).toBe(
      "Choose a .zip, .rar, .7z, or .lua build file"
    );
    expect(getBuildFileValidationError({
      name: "resource.zip",
      size: MAX_BUILD_FILE_SIZE_BYTES + 1,
    })).toBe("Build files must be 64 MiB or smaller");
  });
});
