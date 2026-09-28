export interface BuildSubmissionErrorMessages {
  fileTooLarge: string;
  malwareDetected: string;
  scanLimitExceeded: string;
  scannerUnavailable: string;
  authenticationRequired?: string;
  uploadRateLimited?: string;
  resourceNotFound?: string;
  buildForbidden?: string;
  paidPublishingUnavailable?: string;
  versionAlreadyExists?: string;
  multipartRequired?: string;
  multipartInvalid?: string;
  metadataInvalid?: string;
  buildFileTypeNotAllowed?: string;
  buildContentMismatch?: string;
  buildFileNameInvalid?: string;
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
    case "UNAUTHORIZED":
      return messages.authenticationRequired;
    case "RATE_LIMIT_EXCEEDED":
      return messages.uploadRateLimited;
    case "NOT_FOUND":
      return messages.resourceNotFound;
    case "FORBIDDEN":
      return messages.buildForbidden;
    case "PAID_RESOURCES_DISABLED":
      return messages.paidPublishingUnavailable;
    case "BUILD_VERSION_EXISTS":
      return messages.versionAlreadyExists;
    case "BUILD_MULTIPART_REQUIRED":
      return messages.multipartRequired;
    case "BUILD_MULTIPART_INVALID":
      return messages.multipartInvalid;
    case "BUILD_METADATA_INVALID":
      return messages.metadataInvalid;
    case "BUILD_FILE_TYPE_NOT_ALLOWED":
      return messages.buildFileTypeNotAllowed;
    case "BUILD_CONTENT_MISMATCH":
      return messages.buildContentMismatch;
    case "BUILD_FILE_NAME_INVALID":
      return messages.buildFileNameInvalid;
    default:
      return undefined;
  }
}
