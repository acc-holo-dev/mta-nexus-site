import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { serverClaimApiCopy } from "../../../../../../features/servers/server-claim-api-copy";
import {
  readBoundedJson,
  requireServerJsonContentType,
} from "../../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/http/browser-route-adapter";
import { localeAppErrorText } from "../../../../../../lib/http/locale-app-error";
import { resolveLocale } from "../../../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../../../lib/platform/observability";
import { isPostgresDeadlock } from "../../../../../../lib/platform/postgres-error";
import { authService } from "../../../../../../lib/services/accounts/auth-service";
import { serverClaimService } from "../../../../../../lib/services/servers/server-claim-service";

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

const verifySchema = z
  .object({
    challengeId: z
      .string()
      .regex(/^scc_[0-9a-f-]{36}$/u)
      .max(64),
    token: z.string().regex(/^NXCLAIM-[A-F0-9]{24}$/u),
  })
  .strict();

export const POST = withBrowserMutation(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const context = createRequestLogContext(request);
    const copy = serverClaimApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
    try {
      const sessionToken = request.cookies.get("nexus_session")?.value;
      const user = await authService.getSession(sessionToken);
      if (!sessionToken || !user) {
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

      requireServerJsonContentType(request);
      const parsed = verifySchema.safeParse(await readBoundedJson(request));
      if (!parsed.success) {
        return json(
          context,
          {
            error: copy.invalidProof,
          },
          400,
        );
      }

      const { id: serverId } = await params;
      if (!serverId || serverId.length > 128) {
        return json(context, { error: copy.serverNotFound }, 404);
      }

      // Moderator inbox fanout is committed with the verification request.
      const result = await serverClaimService.verifyChallenge(
        {
          serverId,
          challengeId: parsed.data.challengeId,
          token: parsed.data.token,
        },
        user,
        sessionToken,
      );

      return json(context, result, 201);
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
                failed: copy.verifyFailed,
              },
              {
                ACTOR_REQUIRED: copy.actorRequired,
                VALIDATION_ERROR: copy.invalidProof,
                SERVER_CLAIM_SCOPE_CHANGED: copy.claimChanged,
                SERVER_CLAIM_AUTHORITY_CHANGED: copy.claimChanged,
              },
            ),
            code: error.code,
          },
          error.statusCode,
        );
      }
      logRequestEvent({
        level: "error",
        event: "server.claim_challenge.verify_failed",
        context,
        status: 500,
        error,
      });
      return json(
        context,
        {
          error: copy.verifyFailed,
        },
        500,
      );
    }
  },
);
