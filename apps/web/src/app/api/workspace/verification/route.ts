import { after, type NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { userRepository } from "@nexus/db";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import { userPlatformApi } from "../../../../lib/user-platform-api";
import {
  verificationError,
  verificationMutationError,
} from "../../../../lib/verification-workspace-copy";
import { verificationApplicationSchema } from "../../../../lib/verification-workspace-contract";
import { verificationFilters, verificationRate } from "../../../../lib/verification-workspace-api";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/bounded-json";
import { verificationWorkspaceService } from "../../../../lib/services/verification-workspace-service";
import { dispatchNotificationsBestEffort } from "../../../../lib/services/notification-dispatch-service";
import { createRequestLogContext, logRequestEvent } from "../../../../lib/observability";
export async function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = verificationFilters(request.nextUrl.searchParams);
      await verificationRate(actor.id, "search");
      return verificationWorkspaceService.overview(actor, filters);
    },
    200,
    verificationError,
  );
}
export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  return userPlatformApi(
    request,
    async (actor) => {
      requireServerJsonContentType(request);
      const parsed = verificationApplicationSchema.safeParse(await readBoundedJson(request));
      if (!parsed.success) throw new AppError("Invalid application", 400, "VALIDATION_ERROR");
      await verificationRate(actor.id, "verification");
      const result = await verificationWorkspaceService.apply(actor, parsed.data);
      after(async () => {
        try {
          const dispatch = await dispatchNotificationsBestEffort(
            (await userRepository.listModeratorIds()).map((recipientId) => ({
              recipientId,
              title: "New verification request",
              message: `${result.targetType} verification requested for ${result.targetId}`,
              link: "/admin?verificationView=pending&verificationPage=1",
              type: "security" as const,
            })),
          );
          if (dispatch.storageFailed)
            logRequestEvent({
              level: "warn",
              event: "verification.moderator_notification_partial_failure",
              context,
              status: 201,
              fields: { storageFailed: dispatch.storageFailed },
            });
        } catch (error) {
          logRequestEvent({
            level: "warn",
            event: "verification.moderator_notification_failed",
            context,
            status: 201,
            error,
          });
        }
      });
      return result;
    },
    201,
    verificationMutationError,
  );
});
