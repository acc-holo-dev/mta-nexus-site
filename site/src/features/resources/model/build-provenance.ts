import type { Build } from "@nexus/domain";

export type BuildProvenance = Readonly<{
  scanStatus: Build["scanStatus"];
  scanTone: "positive" | "neutral" | "warning" | "danger";
  scanner: string | null;
  scannedAtLabel: string | null;
  /** Fail-closed public gate: clean verdict + scanner id + scan time must all be present. */
  trustedCleanScan: boolean;
}>;

export function formatProvenanceTimestamp(value?: Date | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/u, " UTC");
}

export function getBuildProvenance(build: {
  scanStatus: Build["scanStatus"] | (string & {});
  scanner?: string | null;
  scannedAt?: Date | null;
}): BuildProvenance {
  const scanStatus = build.scanStatus as Build["scanStatus"];
  const scanner = build.scanner?.trim() || null;
  const scannedAtLabel = formatProvenanceTimestamp(build.scannedAt);
  const scanTone =
    scanStatus === "clean"
      ? "positive"
      : scanStatus === "malicious"
        ? "danger"
        : scanStatus === "error"
          ? "warning"
          : "neutral";

  return Object.freeze({
    scanStatus,
    scanTone,
    scanner,
    scannedAtLabel,
    trustedCleanScan: scanStatus === "clean" && Boolean(scanner && scannedAtLabel),
  });
}
