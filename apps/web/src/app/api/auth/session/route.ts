import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/session-cookie";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import type { NextRequest } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../lib/observability";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(
  context: RequestLogContext,
  body: unknown,
  status = 200,
) {
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
    return json(
      context,
      { error: "Could not check session" },
      503,
    );
  }
}

export const DELETE = withBrowserMutation(async (request: NextRequest) => {

  const context = createRequestLogContext(request);

  try {
    const token = request.cookies.get("nexus_session")?.value;
    if (token) await authService.logout(token);

    const response = json(context, { success: true });
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      ...sessionCookieOptions(),
      maxAge: 0,
      expires: new Date(0),
    });
    return response;
  } catch (error) {
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
        error:
          "Could not confirm sign out. Please try again.",
      },
      503,
    );
  }
});

