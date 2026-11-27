import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { registerSchema } from "@nexus/validation";
import { type NextRequest, NextResponse } from "next/server";
import { authAppErrorText } from "../../../../features/accounts/auth-app-error";
import { authRegisterApiCopy } from "../../../../features/accounts/auth-register-api-copy";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "../../../../features/accounts/session-cookie";
import { getTrustedRequestIp } from "../../../../features/shell/request-client-ip";
import { SESSION_LIFETIME_SECONDS } from "../../../../features/shell/session-policy";
import { readAuthJson } from "../../../../lib/http/auth-request-body";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";
import { resolveLocale } from "../../../../lib/i18n";
import { createRequestLogContext, logRequestEvent } from "../../../../lib/platform/observability";
import { authService } from "../../../../lib/services/accounts/auth-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: privateHeaders,
  });
}

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  const copy = authRegisterApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
  try {
    const ip = getTrustedRequestIp(request);
    const rl = await consumeRateLimit("authRegistration", ip);
    if (!rl.success) {
      return json(
        {
          error: copy.rate,
        },
        429,
      );
    }

    const body = await readAuthJson(request);
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return json(
        {
          error: copy.validationFailed,
          code: "VALIDATION_ERROR",
        },
        400,
      );
    }

    const { user, token } = await authService.register(parsed.data);

    const response = json({ success: true, user }, 201);
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      ...sessionCookieOptions(),
      maxAge: SESSION_LIFETIME_SECONDS,
    });

    return response;
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return json(
        {
          error: authAppErrorText(error, {
            unauthorized: copy.unauthorized,
            conflict: copy.conflict,
            failed: copy.failed,
          }),
          code: error.code,
        },
        error.statusCode,
      );
    }

    logRequestEvent({
      level: "error",
      event: "auth.register.failed",
      context,
      status: 500,
      error,
    });
    return json({ error: copy.failed }, 500);
  }
});
