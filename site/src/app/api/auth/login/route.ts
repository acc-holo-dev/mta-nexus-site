import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { loginSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { authAppErrorText } from "../../../../features/accounts/auth-app-error";
import { authLoginApiCopy } from "../../../../features/accounts/auth-login-api-copy";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "../../../../features/accounts/session-cookie";
import { getTrustedRequestIp } from "../../../../features/shell/request-client-ip";
import { SESSION_LIFETIME_SECONDS } from "../../../../features/shell/session-policy";
import { readAuthJson } from "../../../../lib/http/auth-request-body";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";
import { resolveLocale } from "../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../lib/platform/observability";
import { authService } from "../../../../lib/services/accounts/auth-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(context: RequestLogContext, body: unknown, status = 200) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  const copy = authLoginApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
  try {
    const ip = getTrustedRequestIp(request);
    const rl = await consumeRateLimit("authLogin", ip);
    if (!rl.success) {
      logRequestEvent({
        level: "warn",
        event: "auth.login.rate_limited",
        context,
        status: 429,
      });
      return json(
        context,
        {
          error: copy.rate,
        },
        429,
      );
    }

    const body = await readAuthJson(request);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return json(
        context,
        {
          error: copy.invalidCredentials,
          details: parsed.error.format(),
        },
        400,
      );
    }

    const { user, token } = await authService.login(parsed.data);

    const response = json(context, { success: true, user });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      ...sessionCookieOptions(),
      maxAge: SESSION_LIFETIME_SECONDS,
    });

    return response;
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return json(
        context,
        {
          error: authAppErrorText(error, {
            unauthorized: copy.unauthorized,
            failed: copy.failed,
          }),
          code: error.code,
        },
        error.statusCode,
      );
    }

    logRequestEvent({
      level: "error",
      event: "auth.login.failed",
      context,
      status: 500,
      error,
    });
    return json(context, { error: copy.failed }, 500);
  }
});
