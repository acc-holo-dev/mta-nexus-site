import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/bounded-json";
import { resolveLocale } from "../../../../lib/i18n";
import {
  notificationInboxCommandSchema,
  parseNotificationInboxQuery,
} from "../../../../lib/notification-inbox-contract";
import { notificationInboxError } from "../../../../lib/notification-inbox-copy";
import { notificationInboxService } from "../../../../lib/services/notification-inbox-service";
import { userPlatformApi } from "../../../../lib/user-platform-api";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
export async function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseNotificationInboxQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid inbox filters", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", `notification-inbox:${actor.id}`)).success)
        throw new RateLimitExceededError();
      return notificationInboxService.page(
        actor.id,
        filters,
        resolveLocale(request.cookies.get("nexus_locale")?.value),
      );
    },
    200,
    notificationInboxError,
  );
}
export const PATCH = withBrowserMutation(async (request: NextRequest) => {
  return userPlatformApi(
    request,
    async (actor) => {
      if (!(await consumeRateLimit("notificationMutation", actor.id)).success)
        throw new RateLimitExceededError();
      if ([...request.nextUrl.searchParams].length)
        throw new AppError("Invalid command parameters", 400, "VALIDATION_ERROR");
      requireServerJsonContentType(request);
      const value = await readBoundedJson(request, 32768);
      const parsed = notificationInboxCommandSchema.safeParse(value);
      if (!parsed.success) throw new AppError("Invalid selection", 400, "VALIDATION_ERROR");
      return notificationInboxService.command(actor.id, parsed.data);
    },
    200,
    notificationInboxError,
  );
});
