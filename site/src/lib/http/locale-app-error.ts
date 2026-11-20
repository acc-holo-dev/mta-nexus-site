import type { AppError } from "@nexus/domain";

/**
 * Map known AppError codes to locale copy without leaking English service text.
 * Feature routes may pass `byCode` for domain-specific codes (e.g. REPORT_OWN_TARGET).
 */
export function localeAppErrorText(
  error: AppError,
  copy: {
    unauthorized?: string;
    forbidden?: string;
    notFound?: string;
    conflict?: string;
    freshAuthRequired?: string;
    unsupportedMediaType?: string;
    requestBodyTooLarge?: string;
    invalidBodyLength?: string;
    requestBodyTimeout?: string;
    failed: string;
    [key: string]: string | undefined;
  },
  byCode?: Partial<Record<string, string>>,
): string {
  const override = byCode?.[error.code];
  if (override) return override;

  switch (error.code) {
    case "UNAUTHORIZED":
    case "ACTOR_ID_REQUIRED":
      return copy.unauthorized ?? copy.failed;
    case "FORBIDDEN":
      return copy.forbidden ?? copy.failed;
    case "NOT_FOUND":
      return copy.notFound ?? copy.failed;
    case "FRESH_AUTH_REQUIRED":
      return copy.freshAuthRequired ?? copy.failed;
    case "CONFLICT":
    case "ACCOUNT_CHANGED":
    case "ACTOR_CHANGED":
      return copy.conflict ?? copy.failed;
    case "UNSUPPORTED_MEDIA_TYPE":
      return copy.unsupportedMediaType ?? copy.failed;
    case "REQUEST_BODY_TOO_LARGE":
      return copy.requestBodyTooLarge ?? copy.failed;
    case "INVALID_BODY_LENGTH":
      return copy.invalidBodyLength ?? copy.failed;
    case "REQUEST_BODY_TIMEOUT":
      return copy.requestBodyTimeout ?? copy.failed;
    default:
      return copy.failed;
  }
}
