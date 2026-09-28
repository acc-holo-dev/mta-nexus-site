export interface BuildScanErrorMessages {
  malwareDetected: string;
  scanLimitExceeded: string;
  scannerUnavailable: string;
}

export function getBuildScanErrorMessage(
  code: unknown,
  messages: BuildScanErrorMessages,
): string | undefined {
  switch (code) {
    case "BUILD_MALWARE_DETECTED":
      return messages.malwareDetected;
    case "BUILD_SCAN_LIMIT_EXCEEDED":
      return messages.scanLimitExceeded;
    case "BUILD_SCANNER_UNAVAILABLE":
      return messages.scannerUnavailable;
    default:
      return undefined;
  }
}
