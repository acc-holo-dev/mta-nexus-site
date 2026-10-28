import type { Build } from "@nexus/domain";

export type BuildProvenance = Readonly<{
  scanStatus: Build["scanStatus"];
  scanTone: "positive" | "neutral" | "warning" | "danger";
  scanner: string | null;
  scannedAtLabel: string | null;
}>;

export function formatProvenanceTimestamp(value?: Date): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/u, " UTC");
}

export function getBuildProvenance(
  build: Pick<Build, "scanStatus" | "scanner" | "scannedAt">,
): BuildProvenance {
  const scanTone =
    build.scanStatus === "clean"
      ? "positive"
      : build.scanStatus === "malicious"
        ? "danger"
        : build.scanStatus === "error"
          ? "warning"
          : "neutral";

  return Object.freeze({
    scanStatus: build.scanStatus,
    scanTone,
    scanner: build.scanner?.trim() || null,
    scannedAtLabel: formatProvenanceTimestamp(build.scannedAt),
  });
}
