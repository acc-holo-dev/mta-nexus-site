import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { changePasswordSchema } from "@nexus/validation";
import { type NextRequest, NextResponse } from "next/server";
import { authPasswordApiCopy } from "../../../../features/accounts/auth-password-api-copy";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "../../../../features/accounts/session-cookie";
import { readAuthJson } from "../../../../lib/http/auth-request-body";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";
import { resolveLocale } from "../../../../lib/i18n";
import { createRequestLogContext, logRequestEvent } from "../../../../lib/platform/observability";
import { authService } from "../../../../lib/services/accounts/auth-service";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  const copy = authPasswordApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user || !token) return json({ error: copy.authenticationRequired }, 401);

    const rateLimit = await consumeRateLimit("passwordChange", user.id);
    if (!rateLimit.success) {
      return json({ error: copy.rate }, 429);
    }
    const parsed = changePasswordSchema.safeParse(await readAuthJson(request));
    if (!parsed.success) {
      return json({ error: copy.validationFailed, details: parsed.error.format() }, 400);
    }
    if (parsed.data.expectedActorId !== user.id)
      return json(
        {
          error: copy.accountChanged,
          code: "ACCOUNT_CHANGED",
        },
        409,
      );
    const changed = await authService.changePassword({
      userId: user.id,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      currentToken: token,
    });
    const response = json({ success: true, revokedSessionCount: changed.revokedSessionCount });
    response.cookies.set(SESSION_COOKIE_NAME, changed.token, {
      ...sessionCookieOptions(),
      expires: changed.expiresAt,
    });
    return response;
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    // SQL errors may include bound values: never log passwords, hashes or tokens.
    logRequestEvent({
      level: "error",
      event: "auth.password.change_failed",
      context,
      status: 503,
      error,
    });
    return json({ error: copy.unavailable }, 503);
  }
});
