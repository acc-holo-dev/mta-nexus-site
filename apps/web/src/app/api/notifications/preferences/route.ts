import { notificationRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { notificationPreferencesSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../lib/observability";
import { authService } from "../../../../lib/services/auth-service";

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

  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return json(context, { error: "Authentication required" }, 401);
    }

    const preferences = await notificationRepository.getPreferences(user.id);
    return json(context, { actorId: user.id, preferences });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "notifications.preferences_fetch_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error: "Failed to fetch notification preferences",
      },
      500,
    );
  }
}

export const PATCH = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return json(context, { error: "Authentication required" }, 401);
    }

    requireServerJsonContentType(request);
    const rateLimit = await consumeRateLimit("notificationMutation", user.id);
    if (!rateLimit.success) {
      return json(
        context,
        {
          error: "Too many preference updates. Please try again shortly.",
        },
        429,
      );
    }

    const body = await readBoundedJson(request, 4 * 1024);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json(context, { error: "Invalid notification preferences" }, 400);
    }
    const { expectedActorId, ...changes } = body as Record<string, unknown>;
    if (
      typeof expectedActorId !== "string" ||
      expectedActorId.length === 0 ||
      expectedActorId.length > 128 ||
      expectedActorId.trim() !== expectedActorId
    ) {
      return json(context, { error: "Invalid notification preferences" }, 400);
    }
    if (expectedActorId !== user.id) {
      return json(
        context,
        { error: "Account changed. Reload settings.", code: "ACTOR_CHANGED" },
        409,
      );
    }
    const parsed = notificationPreferencesSchema.safeParse(changes);
    if (!parsed.success) {
      return json(
        context,
        {
          error: "Invalid notification preferences",
          details: parsed.error.format(),
        },
        400,
      );
    }

    const preferences = await notificationRepository.updatePreferences(user.id, parsed.data);
    return json(context, {
      success: true,
      actorId: user.id,
      preferences,
    });
  } catch (error: unknown) {
    if (
      error instanceof AppError &&
      [
        "UNSUPPORTED_MEDIA_TYPE",
        "INVALID_BODY_LENGTH",
        "REQUEST_BODY_TOO_LARGE",
        "REQUEST_BODY_TIMEOUT",
      ].includes(error.code)
    ) {
      return json(context, { error: error.message, code: error.code }, error.statusCode);
    }
    logRequestEvent({
      level: "error",
      event: "notifications.preferences_update_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error: "Failed to update notification preferences",
      },
      500,
    );
  }
});
