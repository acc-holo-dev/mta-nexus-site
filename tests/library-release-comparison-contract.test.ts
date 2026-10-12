import { expect, it } from "vitest";
import {
  compareLibraryReleases,
  comparablePackageSummary,
  type LibraryComparableRelease,
} from "../packages/domain/src/library-release-comparison";
import { libraryReleaseComparisonQuery } from "../apps/web/src/lib/library-release-comparison-query";
const release = (id = "bld_a", hash = "a".repeat(64), size = 100): LibraryComparableRelease => ({
  id,
  version: "1.0.0",
  createdAt: new Date("2026-10-12T00:00:00Z"),
  sha256Hash: hash,
  fileSizeBytes: size,
  fileName: "resource.zip",
  mimeType: "application/zip",
  releaseNotes: null,
  mtaVersionTarget: null,
  isSigned: false,
  packageEvidence: null,
});
it("compares archive identity without assuming version ordering or changed files", () => {
  const from = release(),
    to = { ...release("bld_b", "b".repeat(64), 80), version: "custom release" };
  expect(compareLibraryReleases(from, to)).toMatchObject({
    artifactState: "different",
    sizeDeltaBytes: -20,
    packageChanges: null,
    metadataChanges: { version: true },
  });
  expect(compareLibraryReleases(from, release("bld_b"))).toMatchObject({
    artifactState: "same",
    sizeDeltaBytes: 0,
  });
  expect(compareLibraryReleases(from, release("bld_b", "a".repeat(64), 101)).artifactState).toBe(
    "inconsistent",
  );
});
it("never projects storage or private inventory fields and bounds notes explicitly", () => {
  const value = {
    ...release(),
    storageKey: "SECRET STORAGE",
    publisherSecret: "SECRET",
    releaseNotes: "x".repeat(10001),
  };
  const report = compareLibraryReleases(value, release("bld_b"));
  expect(report.from.notesTruncated).toBe(true);
  expect(report.from.releaseNotes).toHaveLength(10000);
  expect(JSON.stringify(report)).not.toContain("SECRET");
  expect(JSON.stringify(report)).not.toContain("packageEvidence");
});
it("binds the established public summary to the exact artifact and fails closed on malformed evidence", () => {
  const from = release();
  from.packageEvidence = {
    schemaVersion: 1,
    inspector: "nexus-package-v1",
    format: "zip",
    status: "checked",
    sha256Hash: from.sha256Hash,
    fileSizeBytes: 100,
    inspectedAt: "2026-10-12T00:00:00.000Z",
    files: [{ path: "SECRET/file.lua", sha256Hash: "c".repeat(64), fileSizeBytes: 50 }],
    archive: { entries: 1, files: 1, unpackedBytes: 50 },
    manifestStatus: "missing",
    manifest: null,
  };
  const to = {
    ...release("bld_b", "b".repeat(64), 120),
    packageEvidence: {
      ...from.packageEvidence,
      sha256Hash: "b".repeat(64),
      fileSizeBytes: 120,
      archive: { entries: 2, files: 2, unpackedBytes: 90 },
    },
  };
  expect(compareLibraryReleases(from, to)).toMatchObject({
    packageChanges: { archive: { files: 1, entries: 1, unpackedBytes: 40 } },
  });
  expect(JSON.stringify(compareLibraryReleases(from, to))).not.toContain("SECRET");
  expect(comparablePackageSummary({ ...from, sha256Hash: "d".repeat(64) })).toBeNull();
  expect(
    comparablePackageSummary({
      ...from,
      packageEvidence: {
        ...from.packageEvidence,
        archive: { entries: 1, files: -1, unpackedBytes: 50 },
      },
    }),
  ).toBeNull();
  expect(
    comparablePackageSummary({
      ...from,
      packageEvidence: { ...from.packageEvidence, manifest: {} as never },
    }),
  ).toBeNull();
});
it("strictly binds two distinct IDs and the bounded return page", () => {
  expect(
    libraryReleaseComparisonQuery(new URLSearchParams("from=bld_a&to=bld_b&returnPage=2")),
  ).toEqual({ from: "bld_a", to: "bld_b", returnPage: 2 });
  for (const query of [
    "from=bld_a&to=bld_a",
    "from=bld_a",
    "from=../x&to=bld_b",
    "from=bld_a&to=bld_b&returnPage=1001",
    "from=bld_a&from=bld_c&to=bld_b",
    "from=bld_a&to=bld_b&userId=other",
  ])
    expect(() => libraryReleaseComparisonQuery(new URLSearchParams(query))).toThrow();
});
