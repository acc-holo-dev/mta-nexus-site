import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packagePaths = [
  "package.json",
  "apps/web/package.json",
  "packages/config/package.json",
  "packages/db/package.json",
  "packages/domain/package.json",
  "packages/security/package.json",
  "packages/storage/package.json",
  "packages/ui/package.json",
  "packages/validation/package.json",
] as const;

describe("release workspace version consistency", () => {
  it("keeps every private workspace manifest aligned with the root version", () => {
    const manifests = packagePaths.map((path) => ({
      path,
      manifest: JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as {
        version?: string;
        private?: boolean;
      },
    }));

    const rootVersion = manifests[0]?.manifest.version;
    expect(rootVersion).toBeTruthy();

    for (const { path, manifest } of manifests) {
      expect(manifest.private, path).toBe(true);
      expect(manifest.version, path).toBe(rootVersion);
    }
  });
});
