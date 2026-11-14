export interface ResourceSubmissionErrorMessages {
  packageInvalid?: string;
  packageUnsupported?: string;
  packageUnsafePath?: string;
  packageLimitExceeded?: string;
  packageInspectorBusy?: string;
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
  resourceMetadataInvalid?: string;
  resourceSlugAlreadyExists?: string;
  resourceCreationFailed?: string;
}

export function getResourceSubmissionErrorMessage(
  code: unknown,
  messages: ResourceSubmissionErrorMessages,
): string | undefined {
  switch (code) {
    case "BUILD_PACKAGE_INVALID":
      return messages.packageInvalid;
    case "BUILD_PACKAGE_UNSUPPORTED":
      return messages.packageUnsupported;
    case "BUILD_PACKAGE_UNSAFE_PATH":
      return messages.packageUnsafePath;
    case "BUILD_PACKAGE_LIMIT_EXCEEDED":
      return messages.packageLimitExceeded;
    case "BUILD_PACKAGE_INSPECTOR_BUSY":
      return messages.packageInspectorBusy;
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
    case "PRODUCT_METADATA_INVALID":
      return messages.resourceMetadataInvalid;
    case "PRODUCT_SLUG_EXISTS":
      return messages.resourceSlugAlreadyExists;
    case "RESOURCE_CREATION_FAILED":
      return messages.resourceCreationFailed;
    default:
      return undefined;
  }
}
