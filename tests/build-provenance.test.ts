import { describe, expect, it } from "vitest";
import {
  formatProvenanceTimestamp,
  getBuildProvenance,
} from "../apps/web/src/lib/build-provenance";

describe("build provenance presentation", () => {
  it("keeps clean scan, scanner identity and scan time as separate facts", () => {
    const provenance = getBuildProvenance({
      scanStatus: "clean",
      scanner: "clamav",
      scannedAt: new Date("2026-09-25T12:34:56.000Z"),
    });

    expect(provenance).toEqual({
      scanLabel: "Clean scan recorded",
      scanDetail: "Scanner: clamav",
      scanTone: "positive",
      scannedAtLabel: "2026-09-25 12:34:56 UTC",
    });
  });

  it("does not describe unscanned or scanner-error builds as clean", () => {
    expect(
      getBuildProvenance({
        scanStatus: "not_scanned",
        scanner: undefined,
        scannedAt: undefined,
      }),
    ).toMatchObject({
      scanLabel: "Scan not recorded",
      scanTone: "neutral",
    });

    expect(
      getBuildProvenance({
        scanStatus: "error",
        scanner: "clamav",
        scannedAt: undefined,
      }),
    ).toMatchObject({
      scanLabel: "Scanner unavailable",
      scanTone: "warning",
    });
  });

  it("keeps malicious verdict explicit", () => {
    expect(
      getBuildProvenance({
        scanStatus: "malicious",
        scanner: "clamav",
        scannedAt: new Date("2026-09-25T00:00:00.000Z"),
      }),
    ).toMatchObject({
      scanLabel: "Blocked as malicious",
      scanTone: "danger",
    });
  });

  it("formats timestamps deterministically", () => {
    expect(
      formatProvenanceTimestamp(new Date("2026-09-25T01:02:03.000Z")),
    ).toBe("2026-09-25 01:02:03 UTC");
    expect(formatProvenanceTimestamp(undefined)).toBe("Not recorded");
  });
});
