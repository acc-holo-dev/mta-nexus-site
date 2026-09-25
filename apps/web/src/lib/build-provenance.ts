import type { Build } from "@nexus/domain";

export type BuildProvenance = Readonly<{
  scanLabel: string;
  scanDetail: string;
  scanTone: "positive" | "neutral" | "warning" | "danger";
  scannedAtLabel: string;
}>;

export function formatProvenanceTimestamp(value?: Date): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

export function getBuildProvenance(
  build: Pick<Build, "scanStatus" | "scanner" | "scannedAt">,
): BuildProvenance {
  if (build.scanStatus === "clean") {
    return Object.freeze({
      scanLabel: "Clean scan recorded",
      scanDetail: build.scanner
        ? `Scanner: ${build.scanner}`
        : "Scanner identity not recorded",
      scanTone: "positive",
      scannedAtLabel: formatProvenanceTimestamp(build.scannedAt),
    });
  }

  if (build.scanStatus === "malicious") {
    return Object.freeze({
      scanLabel: "Blocked as malicious",
      scanDetail: build.scanner
        ? `Scanner: ${build.scanner}`
        : "Scanner identity not recorded",
      scanTone: "danger",
      scannedAtLabel: formatProvenanceTimestamp(build.scannedAt),
    });
  }

  if (build.scanStatus === "error") {
    return Object.freeze({
      scanLabel: "Scanner unavailable",
      scanDetail: build.scanner
        ? `Scanner: ${build.scanner}`
        : "No successful scanner verdict recorded",
      scanTone: "warning",
      scannedAtLabel: formatProvenanceTimestamp(build.scannedAt),
    });
  }

  return Object.freeze({
    scanLabel: "Scan not recorded",
    scanDetail: "This build does not have a clean scanner verdict.",
    scanTone: "neutral",
    scannedAtLabel: "Not recorded",
  });
}
