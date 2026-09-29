import type { Build } from "./entities";

/**
 * A clean label alone is not enough to publish a user-uploaded build. The
 * closed-beta release gate trusts only a recorded ClamAV verdict with a valid
 * timestamp that is not in the future.
 */
export function hasTrustedCleanBuildScanEvidence(
  build: Pick<Build, "scanStatus" | "scanner" | "scannedAt">,
  now: Date = new Date()
): boolean {
  if (build.scanStatus !== "clean" || build.scanner !== "clamav") return false;
  if (!(build.scannedAt instanceof Date) || !Number.isFinite(build.scannedAt.getTime())) {
    return false;
  }
  return build.scannedAt.getTime() <= now.getTime();
}
