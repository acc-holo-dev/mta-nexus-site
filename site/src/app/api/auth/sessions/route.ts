import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { authSessionsApiCopy } from "../../../../features/accounts/auth-sessions-api-copy";
import { parseSessionRevocation } from "../../../../features/accounts/session-revocation";
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

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  const copy = authSessionsApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const authenticated = await authService.getSessionIdentity(token);
    if (!authenticated) {
      return json(context, { error: copy.authenticationRequired }, 401);
    }

    const { user, sessionId: currentSessionId } = authenticated;
    const sessions = await authService.listSessions(user.id);

    return json(context, {
      actorId: user.id,
      sessions: sessions.map((session) => ({
        ...session,
        isCurrent: session.id === currentSessionId,
      })),
    });
  } catch (error: unknown) {
    logRequestEvent({
      level: "error",
      event: "auth.sessions.list_failed",
      context,
      status: 503,
      error,
    });
    return json(
      context,
      {
        error: copy.listUnavailable,
      },
      503,
    );
  }
}

export const DELETE = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  const copy = authSessionsApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const authenticated = await authService.getSessionIdentity(token);
    if (!authenticated || !token) {
      return json(context, { error: copy.authenticationRequired }, 401);
    }

    const { user, sessionId: currentSessionId } = authenticated;
    const rateLimit = await consumeRateLimit("sessionManagement", user.id);
    if (!rateLimit.success) {
      return json(
        context,
        {
          error: copy.rate,
        },
        429,
      );
    }

    const command = parseSessionRevocation(await readAuthJson(request));
    if (!command) {
      return json(
        context,
        {
          error: copy.invalidAction,
        },
        400,
      );
    }

    if (command.expectedActorId !== user.id) {
      return json(context, { error: copy.accountChanged }, 409);
    }

    if (command.scope === "others") {
      const revokedCount = await authService.revokeOtherSessions(user.id, token);
      return json(context, {
        success: true,
        scope: "others",
        revokedCount,
      });
    }

    if (command.sessionId === currentSessionId) {
      return json(
        context,
        {
          error: copy.currentSessionBlocked,
        },
        409,
      );
    }

    const revoked = await authService.revokeSession(user.id, command.sessionId, token);
    if (!revoked) {
      return json(
        context,
        {
          error: copy.sessionNotFound,
        },
        404,
      );
    }

    return json(context, {
      success: true,
      scope: "single",
      sessionId: command.sessionId,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return json(context, { error: error.message, code: error.code }, error.statusCode);
    }

    logRequestEvent({
      level: "error",
      event: "auth.sessions.revoke_failed",
      context,
      status: 503,
      error,
    });
    return json(
      context,
      {
        error: copy.updateUnavailable,
      },
      503,
    );
  }
});
