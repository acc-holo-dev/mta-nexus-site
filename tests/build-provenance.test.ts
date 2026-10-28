import { describe, expect, it } from "vitest";
import {
  formatProvenanceTimestamp,
  getBuildProvenance,
} from "../apps/web/src/lib/build-provenance";

describe("build provenance presentation", () => {
  it("keeps scan status, scanner identity and scan time as separate facts", () => {
    const provenance = getBuildProvenance({
      scanStatus: "clean",
      scanner: "clamav",
      scannedAt: new Date("2026-09-25T12:34:56.000Z"),
    });

    expect(provenance).toEqual({
      scanStatus: "clean",
      scanTone: "positive",
      scanner: "clamav",
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
      scanStatus: "not_scanned",
      scanTone: "neutral",
      scanner: null,
      scannedAtLabel: null,
    });

    expect(
      getBuildProvenance({
        scanStatus: "error",
        scanner: "clamav",
        scannedAt: undefined,
      }),
    ).toMatchObject({
      scanStatus: "error",
      scanTone: "warning",
    });
  });

  it("keeps malicious verdict explicit as a fact", () => {
    expect(
      getBuildProvenance({
        scanStatus: "malicious",
        scanner: "clamav",
        scannedAt: new Date("2026-09-25T00:00:00.000Z"),
      }),
    ).toMatchObject({
      scanStatus: "malicious",
      scanTone: "danger",
    });
  });

  it("formats timestamps deterministically without embedding locale copy", () => {
    expect(formatProvenanceTimestamp(new Date("2026-09-25T01:02:03.000Z"))).toBe(
      "2026-09-25 01:02:03 UTC",
    );
    expect(formatProvenanceTimestamp(new Date("2026-09-25T01:02:03.987Z"))).toBe(
      "2026-09-25 01:02:03 UTC",
    );
    expect(formatProvenanceTimestamp(undefined)).toBeNull();
  });
});
