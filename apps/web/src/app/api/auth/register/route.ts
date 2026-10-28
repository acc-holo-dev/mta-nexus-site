import { SESSION_LIFETIME_SECONDS } from "../../../../lib/session-policy";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/session-cookie";
import { readAuthJson } from "../../../../lib/auth-request-body";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import { type NextRequest, NextResponse } from "next/server";
import { createRequestLogContext, logRequestEvent } from "../../../../lib/observability";
import { authService } from "../../../../lib/services/auth-service";
import { registerSchema } from "@nexus/validation";
import { consumeRateLimit } from "@nexus/security";
import { AppError } from "@nexus/domain";
import { getTrustedRequestIp } from "../../../../lib/request-client-ip";

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
  try {
    const ip = getTrustedRequestIp(request);
    const rl = await consumeRateLimit("authRegistration", ip);
    if (!rl.success) {
      return json(
        {
          error: "Too many registration attempts. Please try again later.",
        },
        429,
      );
    }

    const body = await readAuthJson(request);
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return json(
        {
          error: "Validation failed",
          details: parsed.error.format(),
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
      return json({ error: error.message, code: error.code }, error.statusCode);
    }

    logRequestEvent({
      level: "error",
      event: "auth.register.failed",
      context,
      status: 500,
      error,
    });
    return json({ error: "Failed to register" }, 500);
  }
});
