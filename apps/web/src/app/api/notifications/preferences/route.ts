import type { NextRequest } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { notificationRepository } from "@nexus/db";
import { notificationPreferencesSchema } from "@nexus/validation";
import { consumeRateLimit } from "@nexus/security";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../lib/observability";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";

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

    if (!user) {
      return json(
        context,
        { error: "Authentication required" },
        401,
      );
    }

    const preferences =
      await notificationRepository.getPreferences(
        user.id,
      );
    return json(context, { preferences });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event:
        "notifications.preferences_fetch_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error:
          "Failed to fetch notification preferences",
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
      return json(
        context,
        { error: "Authentication required" },
        401,
      );
    }

    const rateLimit = await consumeRateLimit(
      "notificationMutation",
      user.id,
    );
    if (!rateLimit.success) {
      return json(
        context,
        {
          error:
            "Too many preference updates. Please try again shortly.",
        },
        429,
      );
    }

    const body = await request
      .json()
      .catch(() => ({}));
    const parsed =
      notificationPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        context,
        {
          error:
            "Invalid notification preferences",
          details: parsed.error.format(),
        },
        400,
      );
    }

    const preferences =
      await notificationRepository.updatePreferences(
        user.id,
        parsed.data,
      );
    return json(context, {
      success: true,
      preferences,
    });
  } catch (error: unknown) {
    logRequestEvent({
      level: "error",
      event:
        "notifications.preferences_update_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error:
          "Failed to update notification preferences",
      },
      500,
    );
  }
});
