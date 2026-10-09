import type { NextRequest } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { consumeRateLimit } from "@nexus/security";
import { AppError } from "@nexus/domain";
import { parseSessionRevocation } from "../../../../lib/session-revocation";
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
    const authenticated = await authService.getSessionIdentity(token);
    if (!authenticated) {
      return json(
        context,
        { error: "Authentication required" },
        401,
      );
    }

    const { user, sessionId: currentSessionId } = authenticated;
    const sessions = await authService.listSessions(user.id);

    return json(context, {
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
        error:
          "Account settings are temporarily unavailable.",
      },
      503,
    );
  }
}

export async function DELETE(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const authenticated = await authService.getSessionIdentity(token);
    if (!authenticated || !token) {
      return json(
        context,
        { error: "Authentication required" },
        401,
      );
    }

    const { user, sessionId: currentSessionId } = authenticated;
    const rateLimit = await consumeRateLimit(
      "sessionManagement",
      user.id,
    );
    if (!rateLimit.success) {
      return json(
        context,
        {
          error:
            "Too many session security requests. Please try again shortly.",
        },
        429,
      );
    }

    const command = parseSessionRevocation(
      await request.json().catch(() => null),
    );
    if (!command) {
      return json(
        context,
        {
          error:
            "Provide exactly one session revocation action",
        },
        400,
      );
    }

    if (command.scope === "others") {
      const revokedCount =
        await authService.revokeOtherSessions(
          user.id,
          token,
        );
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
          error:
            "The current session cannot be revoked here; use logout instead",
        },
        409,
      );
    }

    const revoked = await authService.revokeSession(
      user.id,
      command.sessionId,
      token,
    );
    if (!revoked) {
      return json(
        context,
        {
          error:
            "Session not found or not owned by you",
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
      return json(
        context,
        { error: error.message, code: error.code },
        error.statusCode,
      );
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
        error:
          "Could not confirm the session update. Reload settings before retrying.",
      },
      503,
    );
  }
}
