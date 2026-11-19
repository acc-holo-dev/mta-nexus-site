import type { AppError } from "@nexus/domain";

/** Map known auth AppError codes to locale copy without leaking English service text. */
export function authAppErrorText(
  error: AppError,
  copy: {
    unauthorized?: string;
    freshAuthRequired?: string;
    conflict?: string;
    failed: string;
    [key: string]: string | undefined;
  },
): string {
  switch (error.code) {
    case "UNAUTHORIZED":
    case "ACTOR_ID_REQUIRED":
      return copy.unauthorized ?? copy.failed;
    case "FRESH_AUTH_REQUIRED":
      return copy.freshAuthRequired ?? copy.failed;
    case "CONFLICT":
    case "ACCOUNT_CHANGED":
    case "ACTOR_CHANGED":
      return copy.conflict ?? copy.failed;
    default:
      return copy.failed;
  }
}
