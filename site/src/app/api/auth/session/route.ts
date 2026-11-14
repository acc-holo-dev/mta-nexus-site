import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { readAuthJson } from "../../../../lib/auth-request-body";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../lib/observability";
import { authService } from "../../../../lib/services/auth-service";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/session-cookie";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

const logoutSchema = z
  .object({
    expectedActorId: z
      .string()
      .min(1)
      .max(128)
      .refine((value) => value.trim() === value),
  })
  .strict();

function json(context: RequestLogContext, body: unknown, status = 200) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    return json(context, {
      authenticated: Boolean(user),
      user: user ?? null,
    });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "auth.session.read_failed",
      context,
      status: 503,
      error,
    });
    return json(context, { error: "Could not check session" }, 503);
  }
}

export const DELETE = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);

  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = token ? await authService.getSession(token) : null;
    if (token && user) {
      const parsed = logoutSchema.safeParse(await readAuthJson(request));
      if (!parsed.success) return json(context, { error: "Invalid sign out request" }, 400);
      if (parsed.data.expectedActorId !== user.id) {
        return json(
          context,
          { error: "Account changed. Reload and try again.", code: "ACTOR_CHANGED" },
          409,
        );
      }
      await authService.logout(token);
    } else if (token) {
      // Preserve cleanup of an expired or otherwise invalid session token.
      await authService.logout(token);
    }

    const response = json(context, { success: true });
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      ...sessionCookieOptions(),
      maxAge: 0,
      expires: new Date(0),
    });
    return response;
  } catch (error) {
    if (
      error instanceof AppError &&
      [
        "UNSUPPORTED_MEDIA_TYPE",
        "INVALID_BODY_LENGTH",
        "REQUEST_BODY_TOO_LARGE",
        "REQUEST_BODY_TIMEOUT",
      ].includes(error.code)
    )
      return json(context, { error: error.message, code: error.code }, error.statusCode);
    logRequestEvent({
      level: "error",
      event: "auth.session.logout_failed",
      context,
      status: 503,
      error,
    });
    return json(
      context,
      {
        error: "Could not confirm sign out. Please try again.",
      },
      503,
    );
  }
});
