import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit, generateId } from "@nexus/security";
import type { NextRequest } from "next/server";
import { withBrowserMutation } from "../../../lib/browser-route-adapter";
import { readBoundedJson, requireServerJsonContentType } from "../../../lib/bounded-json";
import { objectMuteCommandSchema } from "../../../lib/follow-workspace-contract";
import { followError } from "../../../lib/follow-workspace-copy";
import { resolveLocale } from "../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../lib/observability";
import { authService } from "../../../lib/services/auth-service";
import { followWorkspaceService } from "../../../lib/services/follow-workspace-service";
import { userPlatformApi } from "../../../lib/user-platform-api";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
  try {
    const params = request.nextUrl.searchParams;
    const parsed = objectMuteCommandSchema.safeParse({
      targetType: params.get("targetType"),
      targetId: params.get("targetId"),
      duration: null,
    });
    if (
      !parsed.success ||
      params.getAll("targetType").length !== 1 ||
      params.getAll("targetId").length !== 1
    )
      throw new AppError("Invalid mute target", 400, "VALIDATION_ERROR");
    const actor = await authService.getSession(request.cookies.get("nexus_session")?.value);
    if (!actor) {
      return jsonWithRequestId(
        context,
        {
          authenticated: false,
          muted: false,
          mutedUntil: null,
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
        },
        { headers: privateHeaders },
      );
    }
    const state = await followWorkspaceService.muteState(
      actor.id,
      parsed.data.targetType,
      parsed.data.targetId,
    );
    return jsonWithRequestId(
      context,
      {
        authenticated: true,
        ...state,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    const known = error instanceof AppError;
    if (!known)
      logRequestEvent({
        level: "error",
        event: "object_mute.state_failed",
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

export const POST = withBrowserMutation((request: NextRequest) =>
  userPlatformApi(
    request,
    async (actor) => {
      if (!(await consumeRateLimit("follow", actor.id)).success) throw new RateLimitExceededError();
      requireServerJsonContentType(request);
      const parsed = objectMuteCommandSchema.safeParse(await readBoundedJson(request, 32 * 1024));
      if (!parsed.success) throw new AppError("Invalid mute command", 400, "VALIDATION_ERROR");
      const { targetType, targetId, duration } = parsed.data;
      const result = await followWorkspaceService.setObjectMute(
        actor.id,
        targetType,
        targetId,
        duration,
        generateId("mute"),
      );
      return {
        success: true,
        targetType,
        targetId,
        muted: result.muted,
        mutedUntil: result.mutedUntil,
      };
    },
    200,
    followError,
  ),
);
