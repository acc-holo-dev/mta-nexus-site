import { readAuthJson } from "../../../../lib/auth-request-body";
import { rejectUnsafeBrowserRequest } from "../../../../lib/browser-request-guard";
import { randomInt } from "node:crypto";
import type { NextRequest } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { confirmPasswordResetSchema, requestPasswordResetSchema } from "@nexus/validation";
import { AppError } from "@nexus/domain";
import { getTrustedRequestIp } from "../../../../lib/request-client-ip";
import { createRequestLogContext, jsonWithRequestId, logRequestEvent, type RequestLogContext } from "../../../../lib/observability";
import {
  PASSWORD_RESET_NEUTRAL_RESPONSE,
  PASSWORD_RESET_REQUEST_FLOOR_JITTER_MS,
  passwordResetTargetMs,
  waitForPasswordResetFloor,
} from "../../../../lib/account-recovery-request-policy";
const headers = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};
function json(context: RequestLogContext, body: unknown, status = 200) {
  return jsonWithRequestId(context, body, { status, headers });
}


export async function POST(request: NextRequest) {
  const rejected = rejectUnsafeBrowserRequest(request);
  if (rejected) return rejected;
  const context = createRequestLogContext(request);
  const startedAt = performance.now();
  const targetMs = passwordResetTargetMs(
    randomInt(0, PASSWORD_RESET_REQUEST_FLOOR_JITTER_MS + 1),
  );
  try {
    const parsed = requestPasswordResetSchema.safeParse(await readAuthJson(request));
    if (!parsed.success) {
      return json(context, { error: "Enter a valid email address." }, 400);
    }
    await authService.requestPasswordReset({
      email: parsed.data.email,
      ip: getTrustedRequestIp(request),
    });
    await waitForPasswordResetFloor(startedAt, targetMs);
    return json(context, PASSWORD_RESET_NEUTRAL_RESPONSE, 202);
  } catch (error: unknown) {
    if (error instanceof AppError && [400, 408, 413, 415].includes(error.statusCode)) {
      return json(context, { error: "Invalid request body", code: error.code }, error.statusCode);
    }
    // Missing dedicated keys or shared persistence failure makes recovery
    // unavailable for every address; do not expose account-specific detail.
    logRequestEvent({
      level: "error",
      event: "auth.password_reset.request_unavailable",
      context,
      status: 503,
    });
    await waitForPasswordResetFloor(startedAt, targetMs);
    return json(context, { error: "Password reset is temporarily unavailable. Please try again later." }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  const rejected = rejectUnsafeBrowserRequest(request);
  if (rejected) return rejected;
  const context = createRequestLogContext(request);
  try {
    const parsed = confirmPasswordResetSchema.safeParse(await readAuthJson(request));
    if (!parsed.success) return json(context, { error: "Invalid or expired password reset" }, 400);
    await authService.confirmPasswordReset({
      ...parsed.data,
      ip: getTrustedRequestIp(request),
    });
    return json(context, { success: true });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      if ([400, 408, 413, 415].includes(error.statusCode)) {
        return json(context, { error: "Invalid request body", code: error.code }, error.statusCode);
      }
      return json(context, { error: "Invalid or expired password reset" }, 400);
    }
    logRequestEvent({
      level: "error",
      event: "auth.password_reset.confirm_failed",
      context,
      status: 503,
      error,
    });
    return json(context, { error: "Could not reset the password. Request a new link and try again." }, 503);
  }
}

