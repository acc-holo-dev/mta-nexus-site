export interface BuildSubmissionErrorMessages {
  fileTooLarge: string;
  malwareDetected: string;
  scanLimitExceeded: string;
  scannerUnavailable: string;
}

export function getBuildSubmissionErrorMessage(
  code: unknown,
  messages: BuildSubmissionErrorMessages,
): string | undefined {
  switch (code) {
    case "BUILD_UPLOAD_TOO_LARGE":
      return messages.fileTooLarge;
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
