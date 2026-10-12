import { followWorkspaceRepository, socialRepository } from "@nexus/db";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit, generateId } from "@nexus/security";
import { after, type NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../lib/bounded-json";
import { followCommandSchema } from "../../../lib/follow-workspace-contract";
import { followError } from "../../../lib/follow-workspace-copy";
import { resolveLocale } from "../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../lib/observability";
import { authService } from "../../../lib/services/auth-service";
import { dispatchNotificationsBestEffort } from "../../../lib/services/notification-dispatch-service";
import { userPlatformApi } from "../../../lib/user-platform-api";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
  try {
    const params = request.nextUrl.searchParams;
    const parsed = followCommandSchema.safeParse({
      targetType: params.get("targetType"),
      targetId: params.get("targetId"),
    });
    if (
      !parsed.success ||
      params.getAll("targetType").length !== 1 ||
      params.getAll("targetId").length !== 1
    )
      throw new AppError("Invalid follow target", 400, "VALIDATION_ERROR");
    const actor = await authService.getSession(request.cookies.get("nexus_session")?.value);
    const following = actor
      ? parsed.data.targetType === "content"
        ? (
            await followWorkspaceRepository.states(actor.id, "content", [parsed.data.targetId])
          ).includes(parsed.data.targetId)
        : await socialRepository.isFollowing(actor.id, parsed.data.targetType, parsed.data.targetId)
      : false;
    return jsonWithRequestId(
      context,
      {
        authenticated: !!actor,
        following,
        ...parsed.data,
        ...(actor && parsed.data.targetType === "user" && parsed.data.targetId === actor.id
          ? { self: true }
          : {}),
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    const known = error instanceof AppError;
    if (!known)
      logRequestEvent({
        level: "error",
        event: "follow.state_failed",
        context,
        status: 503,
        error,
      });
    const code = known ? error.code : "INTERNAL_ERROR";
    return jsonWithRequestId(
      context,
      { code, error: followError(locale, code) },
      { status: known ? error.statusCode : 503, headers: privateHeaders },
    );
  }
}
function mutation(request: NextRequest, following: boolean) {
  return userPlatformApi(
    request,
    async (actor) => {
      if (!(await consumeRateLimit("follow", actor.id)).success) throw new RateLimitExceededError();
      requireServerJsonContentType(request);
      const parsed = followCommandSchema.safeParse(await readBoundedJson(request, 32 * 1024));
      if (!parsed.success) throw new AppError("Invalid follow command", 400, "VALIDATION_ERROR");
      const { targetType, targetId } = parsed.data;
      const result = await followWorkspaceRepository.setFollowing(
        actor.id,
        targetType,
        targetId,
        following,
        generateId("fol"),
      );
      if (result.created && targetType === "user") {
        const context = createRequestLogContext(request);
        after(async () => {
          try {
            await dispatchNotificationsBestEffort([
              {
                recipientId: targetId,
                title: "New Follower",
                message: `@${actor.username} started following your activity.`,
                type: "system",
                category: "follow",
                link: `/users/${encodeURIComponent(actor.username)}`,
              },
            ]);
          } catch (error) {
            logRequestEvent({
              level: "warn",
              event: "follow.notification_delivery_failed",
              context,
              status: 200,
              error,
            });
          }
        });
      }
      return { success: true, targetType, targetId, following: result.following };
    },
    200,
    followError,
  );
}
export function POST(request: NextRequest) {
  return mutation(request, true);
}
export function DELETE(request: NextRequest) {
  return mutation(request, false);
}
