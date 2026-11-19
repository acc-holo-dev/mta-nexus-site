import { notificationRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { notificationMarkReadApiCopy } from "../../../../features/notifications/notification-mark-read-api-copy";
import { parseNotificationReadTarget } from "../../../../features/notifications/notification-read";
import { readBoundedText } from "../../../../lib/http/bounded-json";
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
  const copy = notificationMarkReadApiCopy(
    resolveLocale(request.cookies.get("nexus_locale")?.value),
  );
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return json(context, { error: copy.unauthorized }, 401);
    }

    const rateLimit = await consumeRateLimit("notificationMutation", user.id);
    if (!rateLimit.success) {
      return json(
        context,
        {
          error: copy.rate,
        },
        429,
      );
    }

    const target = parseNotificationReadTarget(await readBoundedText(request, 4096));
    if (!target) {
      return json(context, { error: copy.invalidTarget }, 400);
    }
    if (target.expectedActorId !== user.id)
      return json(context, { error: copy.accountChanged, code: "ACCOUNT_CHANGED" }, 409);

    if (target.scope === "single") {
      const updated = await notificationRepository.markAsRead(target.id, user.id);
      if (!updated) {
        return json(
          context,
          {
            error: copy.notFound,
          },
          404,
        );
      }
      return json(context, {
        success: true,
        scope: "single",
        id: target.id,
      });
    }

    await notificationRepository.markAllAsRead(user.id);
    return json(context, {
      success: true,
      scope: "all",
    });
  } catch (error: unknown) {
    if (
      error instanceof AppError &&
      ["INVALID_BODY_LENGTH", "REQUEST_BODY_TOO_LARGE", "REQUEST_BODY_TIMEOUT"].includes(error.code)
    ) {
      return json(
        context,
        {
          error: copy.invalidTarget,
          code: error.code,
        },
        error.statusCode,
      );
    }
    logRequestEvent({
      level: "error",
      event: "notifications.mark_read_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error: copy.markFailed,
      },
      500,
    );
  }
});
