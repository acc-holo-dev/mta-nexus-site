import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../features/accounts/user-platform-api";
import { parseNotificationInboxQuery } from "../../../../../features/notifications/notification-inbox-contract";
import { notificationInboxError } from "../../../../../features/notifications/notification-inbox-copy";
import { resolveLocale } from "../../../../../lib/i18n";
import { notificationInboxService } from "../../../../../lib/services/notifications/notification-inbox-service";

export async function GET(request: NextRequest) {
  const response = await userPlatformApi(
    request,
    async (actor) => {
      const filters = parseNotificationInboxQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid inbox export filters", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", `notification-inbox:${actor.id}`)).success)
        throw new RateLimitExceededError();
      return notificationInboxService.exportPage(
        actor.id,
        filters,
        resolveLocale(request.cookies.get("nexus_locale")?.value),
      );
    },
    200,
    notificationInboxError,
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (response.status === 200)
    response.headers.set(
      "Content-Disposition",
      'attachment; filename="nexus-notification-page.json"',
    );
  return response;
}
