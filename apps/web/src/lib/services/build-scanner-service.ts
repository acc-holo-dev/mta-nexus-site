export type BuildScanResult =
  | { status: "not_scanned"; scanner: "disabled"; scannedAt: Date }
  | { status: "clean"; scanner: string; scannedAt: Date }
  | { status: "malicious"; scanner: string; scannedAt: Date; reason?: string }
  | { status: "error"; scanner: string; scannedAt: Date; reason?: string };

export interface BuildScanner {
  scan(input: {
    bytes: Uint8Array;
    fileName: string;
  }): Promise<BuildScanResult>;
}

/**
 * Closed beta has no malware-scanning infrastructure yet. This is deliberately
 * explicit: uploads require manual review instead of being represented as clean.
 * A ClamAV or external scanner adapter can replace this implementation without
 * changing the upload/review workflow.
 */
const disabledScanner: BuildScanner = {
  async scan() {
    return {
      status: "not_scanned",
      scanner: "disabled",
      scannedAt: new Date(),
    };
  },
};

export const buildScannerService = disabledScanner;
