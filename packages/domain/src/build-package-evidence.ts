/** Evidence describes received bytes, never successful execution or source-code DRM. */
export type BuildPackageEvidence = {
  files: BuildPackageFile[] | null;
  schemaVersion: 1;
  inspector: "nexus-package-v1";
  format: "zip" | "rar" | "7z" | "lua";
  status: "checked" | "not_inspected";
  sha256Hash: string;
  fileSizeBytes: number;
  inspectedAt: string;
  archive: { entries: number; files: number; unpackedBytes: number } | null;
  manifestStatus: "single" | "missing" | "multiple" | "not_inspected";
  manifest: {
    path: string;
    sha256Hash: string;
    byteLength: number;
    parser: "best_effort_static";
    root: "meta" | "unknown";
    scripts: { client: number; server: number; shared: number; unknown: number };
    minimumMta: { client: string | null; server: string | null; both: string | null } | null;
    dependencies: string[];
    aclRights: string[];
    references: {
      kind: "script" | "file" | "map" | "config" | "html";
      path: string;
      status: "present" | "missing" | "pattern" | "external" | "unsafe";
    }[];
    referencesTruncated: boolean;
    issues: { code: string; severity: "warning" | "error" }[];
  } | null;
};
export type BuildPackageFile = { path: string; sha256Hash: string; fileSizeBytes: number };
export type BuildPackageChange = "recorded" | "added" | "removed" | "changed" | "unchanged";
export type BuildPackageFilter = "all" | "added" | "removed" | "changed" | "unchanged";

/** Explicit public projection excludes source paths, ACL names and dependency declarations. */
export function buildPackageSummary(evidence: BuildPackageEvidence | null | undefined) {
  if (!evidence) return null;
  return {
    format: evidence.format,
    status: evidence.status,
    archive: evidence.archive
      ? {
          entries: evidence.archive.entries,
          files: evidence.archive.files,
          unpackedBytes: evidence.archive.unpackedBytes,
        }
      : null,
    manifestStatus: evidence.manifestStatus,
    scripts: evidence.manifest
      ? {
          client: evidence.manifest.scripts.client,
          server: evidence.manifest.scripts.server,
          shared: evidence.manifest.scripts.shared,
          unknown: evidence.manifest.scripts.unknown,
        }
      : null,
    missingReferences:
      evidence.manifest?.references.filter((item) => item.status === "missing").length ?? 0,
    unresolvedReferences:
      evidence.manifest?.references.filter((item) => !["present", "missing"].includes(item.status))
        .length ?? 0,
    referencesTruncated: evidence.manifest?.referencesTruncated ?? false,
    issueCount: evidence.manifest?.issues.length ?? 0,
  };
}
export type BuildPackageSummary = ReturnType<typeof buildPackageSummary>;
