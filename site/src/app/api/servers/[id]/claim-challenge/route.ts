import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { serverClaimApiCopy } from "../../../../../features/servers/server-claim-api-copy";
import { withBrowserMutation } from "../../../../../lib/http/browser-route-adapter";
import { localeAppErrorText } from "../../../../../lib/http/locale-app-error";
import { resolveLocale } from "../../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../../lib/platform/observability";
import { isPostgresDeadlock } from "../../../../../lib/platform/postgres-error";
import { authService } from "../../../../../lib/services/accounts/auth-service";
import { serverClaimService } from "../../../../../lib/services/servers/server-claim-service";

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

export const POST = withBrowserMutation(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const context = createRequestLogContext(request);
    const copy = serverClaimApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
    try {
      const token = request.cookies.get("nexus_session")?.value;
      const user = await authService.getSession(token);
      if (!token || !user) {
        return json(context, { error: copy.authenticationRequired }, 401);
      }

      const expectedActor = request.headers.get("x-nexus-actor-id");
      if (!expectedActor)
        return json(context, { code: "ACTOR_ID_REQUIRED", error: copy.actorRequired }, 428);
      if (expectedActor !== user.id)
        return json(context, { code: "ACTOR_CHANGED", error: copy.accountChanged }, 409);

      const rateLimit = await consumeRateLimit("serverClaimProof", user.id);
      if (!rateLimit.success) {
        return json(
          context,
          {
            error: copy.rate,
          },
          429,
        );
      }

      const { id: serverId } = await params;
      if (!serverId || serverId.length > 128) {
        return json(context, { error: copy.serverNotFound }, 404);
      }

      const challenge = await serverClaimService.issueChallenge(serverId, user, token);

      return json(
        context,
        {
          challenge,
          instruction: copy.instruction,
        },
        201,
      );
    } catch (error: unknown) {
      if (isPostgresDeadlock(error))
        return json(context, { code: "SERVER_CLAIM_RETRY", error: copy.retry }, 409);
      if (error instanceof AppError) {
        return json(
          context,
          {
            error: localeAppErrorText(
              error,
              {
                unauthorized: copy.authenticationRequired,
                forbidden: copy.forbidden,
                notFound: copy.serverNotFound,
                conflict: copy.accountChanged,
                unsupportedMediaType: copy.unsupportedMediaType,
                requestBodyTooLarge: copy.requestBodyTooLarge,
                invalidBodyLength: copy.invalidBodyLength,
                requestBodyTimeout: copy.requestBodyTimeout,
                failed: copy.createFailed,
              },
              { ACTOR_REQUIRED: copy.actorRequired },
            ),
            code: error.code,
          },
          error.statusCode,
        );
      }
      logRequestEvent({
        level: "error",
        event: "server.claim_challenge.create_failed",
        context,
        status: 500,
        error,
      });
      return json(
        context,
        {
          error: copy.createFailed,
        },
        500,
      );
    }
  },
);
