import type { Locale } from "../../lib/i18n";
import { adminActionsApiCopy } from "./admin-actions-api-copy";

/** Map admin `/api/admin/actions` error codes to locale copy without trusting English bodies. */
export function adminActionClientError(locale: Locale, code: unknown, fallback: string): string {
  const copy = adminActionsApiCopy(locale);
  switch (code) {
    case "FORBIDDEN":
      return copy.forbidden;
    case "UNAUTHORIZED":
    case "ACTOR_ID_REQUIRED":
      return copy.authenticationRequired;
    case "ACTOR_CHANGED":
    case "CONFLICT":
    case "CONTENT_STATE_CHANGED":
    case "REPORT_STATE_CHANGED":
    case "BUILD_STATE_CHANGED":
      return copy.conflict;
    case "NOT_FOUND":
      return copy.notFound;
    case "VALIDATION_ERROR":
    case "INVALID_ACTION":
      return copy.invalidAction;
    case "RATE_LIMIT_EXCEEDED":
    case "RATE_LIMITED":
      return copy.rate;
    case "UNSUPPORTED_MEDIA_TYPE":
      return copy.unsupportedMediaType;
    case "REQUEST_BODY_TOO_LARGE":
      return copy.requestBodyTooLarge;
    case "INVALID_BODY_LENGTH":
      return copy.invalidBodyLength;
    case "REQUEST_BODY_TIMEOUT":
      return copy.requestBodyTimeout;
    case "PRODUCT_NOT_FOUND":
      return copy.productNotFound;
    case "REPORT_NOT_FOUND":
      return copy.reportNotFound;
    case "VERIFICATION_NOT_FOUND":
      return copy.verificationNotFound;
    default:
      return fallback;
  }
}
