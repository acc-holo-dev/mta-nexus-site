import { buildPackageSummary, type BuildPackageEvidence } from "./build-package-evidence";
export type LibraryReleaseComparisonQuery = { from: string; to: string; returnPage: number };
export type LibraryComparableRelease = {
  id: string;
  version: string;
  createdAt: Date;
  sha256Hash: string;
  fileSizeBytes: number;
  fileName: string;
  mimeType: string;
  releaseNotes: string | null;
  mtaVersionTarget: string | null;
  isSigned: boolean;
  packageEvidence: BuildPackageEvidence | null;
};
/** Return only the established public summary, bound to the compared artifact. */
export function comparablePackageSummary(
  release: Pick<LibraryComparableRelease, "packageEvidence" | "sha256Hash" | "fileSizeBytes">,
) {
  const evidence = release.packageEvidence;
  if (
    evidence?.schemaVersion !== 1 ||
    evidence.inspector !== "nexus-package-v1" ||
    evidence.sha256Hash !== release.sha256Hash ||
    evidence.fileSizeBytes !== release.fileSizeBytes
  )
    return null;
  try {
    const summary = buildPackageSummary(evidence);
    if (
      !summary ||
      !["zip", "rar", "7z", "lua"].includes(summary.format) ||
      !["checked", "not_inspected"].includes(summary.status) ||
      !["single", "missing", "multiple", "not_inspected"].includes(summary.manifestStatus) ||
      typeof summary.referencesTruncated !== "boolean"
    )
      return null;
    const counts = [
      summary.missingReferences,
      summary.unresolvedReferences,
      summary.issueCount,
      ...(summary.archive ? Object.values(summary.archive) : []),
      ...(summary.scripts ? Object.values(summary.scripts) : []),
    ];
    return counts.every((value) => Number.isSafeInteger(value) && value >= 0) ? summary : null;
  } catch {
    return null;
  }
}
export function compareLibraryReleases(
  from: LibraryComparableRelease,
  to: LibraryComparableRelease,
) {
  function publicRelease(release: LibraryComparableRelease) {
    const releaseNotes = release.releaseNotes;
    return {
      id: release.id,
      version: release.version,
      createdAt: release.createdAt,
      sha256Hash: release.sha256Hash,
      fileSizeBytes: release.fileSizeBytes,
      fileName: release.fileName,
      mimeType: release.mimeType,
      mtaVersionTarget: release.mtaVersionTarget,
      isSigned: release.isSigned,
      releaseNotes: releaseNotes?.slice(0, 10000) ?? null,
      notesTruncated: (releaseNotes?.length ?? 0) > 10000,
      packageSummary: comparablePackageSummary(release),
    };
  }
  const source = publicRelease(from),
    target = publicRelease(to),
    a = source.packageSummary,
    b = target.packageSummary;
  return {
    from: source,
    to: target,
    artifactState:
      from.sha256Hash === to.sha256Hash
        ? from.fileSizeBytes === to.fileSizeBytes
          ? ("same" as const)
          : ("inconsistent" as const)
        : ("different" as const),
    sizeDeltaBytes: to.fileSizeBytes - from.fileSizeBytes,
    metadataChanges: {
      version: from.version !== to.version,
      fileName: from.fileName !== to.fileName,
      mimeType: from.mimeType !== to.mimeType,
      releaseNotes: from.releaseNotes !== to.releaseNotes,
      mtaVersionTarget: from.mtaVersionTarget !== to.mtaVersionTarget,
      isSigned: from.isSigned !== to.isSigned,
    },
    packageChanges:
      a && b
        ? {
            formatChanged: a.format !== b.format,
            statusChanged: a.status !== b.status,
            manifestStatusChanged: a.manifestStatus !== b.manifestStatus,
            archive:
              a.archive && b.archive
                ? {
                    files: b.archive.files - a.archive.files,
                    entries: b.archive.entries - a.archive.entries,
                    unpackedBytes: b.archive.unpackedBytes - a.archive.unpackedBytes,
                  }
                : null,
            scripts:
              a.scripts && b.scripts
                ? {
                    client: b.scripts.client - a.scripts.client,
                    server: b.scripts.server - a.scripts.server,
                    shared: b.scripts.shared - a.scripts.shared,
                    unknown: b.scripts.unknown - a.scripts.unknown,
                  }
                : null,
            missingReferences: b.missingReferences - a.missingReferences,
            unresolvedReferences: b.unresolvedReferences - a.unresolvedReferences,
            issueCount: b.issueCount - a.issueCount,
            referencesTruncated: a.referencesTruncated || b.referencesTruncated,
          }
        : null,
  };
}
