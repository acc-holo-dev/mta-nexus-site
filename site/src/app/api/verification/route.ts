import { organizationRepository, verificationRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { consumeRateLimit, generateId } from "@nexus/security";
import { externalWebUrlSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { verificationApiCopy } from "../../../features/trust/verification-api-copy";
import { readBoundedJson, requireServerJsonContentType } from "../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../lib/http/browser-route-adapter";
import { localeAppErrorText } from "../../../lib/http/locale-app-error";
import { resolveLocale } from "../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../lib/platform/observability";
import { isPostgresDeadlock } from "../../../lib/platform/postgres-error";
import { authService } from "../../../lib/services/accounts/auth-service";

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

const verificationRequestSchema = z
  .object({
    targetType: z.enum(["user", "developer", "organization", "server"]),
    targetId: z.string().min(1).max(128),
    proofUrl: externalWebUrlSchema.optional().or(z.literal("")),
    notes: z.string().max(1000).optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  const copy = verificationApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));

  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!token || !user) {
      return json(context, { error: copy.unauthorized }, 401);
    }

    const requests = await verificationRepository.listByRequester(user.id);
    return json(context, { requests });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "verification.history_fetch_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error: copy.loadFailed,
      },
      500,
    );
  }
}

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  const copy = verificationApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!token || !user) {
      return json(context, { error: copy.authenticationRequired }, 401);
    }

    requireServerJsonContentType(request);
    const rateLimit = await consumeRateLimit("verification", user.id);
    if (!rateLimit.success) {
      return json(
        context,
        {
          error: copy.rate,
        },
        429,
      );
    }

    const body = await readBoundedJson(request);
    const parsed = verificationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return json(
        context,
        {
          error: copy.invalidRequest,
          details: parsed.error.format(),
        },
        400,
      );
    }

    if (parsed.data.targetType === "server") {
      return json(
        context,
        {
          error: copy.serverChallengeRequired,
          code: "SERVER_CONTROL_CHALLENGE_REQUIRED",
        },
        422,
      );
    }

    let targetIsVerified = false;

    if (parsed.data.targetType === "user" || parsed.data.targetType === "developer") {
      if (parsed.data.targetId !== user.id) {
        return json(
          context,
          {
            error: copy.ownProfileOnly,
          },
          403,
        );
      }
      // Identity and experience use separate live flags in the repository.
      targetIsVerified = parsed.data.targetType === "user" && user.isVerified;
    } else {
      const organization = await organizationRepository.findById(parsed.data.targetId);
      if (!organization) {
        return json(
          context,
          {
            error: copy.organizationNotFound,
          },
          404,
        );
      }

      const memberships = await organizationRepository.listUserMemberships(user.id);
      const membership = memberships.find(
        (candidate) => candidate.organizationId === organization.id,
      );

      if (
        organization.ownerId !== user.id &&
        (!membership || (membership.role !== "owner" && membership.role !== "admin"))
      ) {
        return json(
          context,
          {
            error: copy.organizationNotManaged,
          },
          403,
        );
      }

      targetIsVerified = organization.isVerified;
    }

    if (targetIsVerified) {
      return json(
        context,
        {
          error: copy.alreadyVerified,
        },
        409,
      );
    }

    const duplicate = await verificationRepository.findPendingForTarget(
      user.id,
      parsed.data.targetType,
      parsed.data.targetId,
    );
    if (duplicate) {
      return json(
        context,
        {
          error: copy.alreadyPending,
          requestId: duplicate.id,
        },
        409,
      );
    }

    // Moderator inbox fanout is committed with the request as
    // verification_notification_deliveries; the push worker pages recipients.
    const verificationRequest = await verificationRepository.createRequest(
      {
        requesterId: user.id,
        currentToken: token,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        proofUrl: parsed.data.proofUrl || undefined,
        notes: parsed.data.notes,
      },
      {
        id: generateId("aud"),
        actorId: user.id,
        actorType: "user",
        action: "verification.requested",
        details: {
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
        },
      },
    );

    return json(
      context,
      {
        success: true,
        request: verificationRequest,
      },
      201,
    );
  } catch (error: unknown) {
    if (isPostgresDeadlock(error))
      return json(context, { code: "VERIFICATION_RETRY", error: copy.retry }, 409);
    if (error instanceof AppError) {
      return json(
        context,
        {
          error: localeAppErrorText(
            error,
            {
              unauthorized: copy.authenticationRequired,
              forbidden: copy.forbidden,
              notFound: copy.notFound,
              conflict: copy.conflict,
              unsupportedMediaType: copy.unsupportedMediaType,
              requestBodyTooLarge: copy.requestBodyTooLarge,
              invalidBodyLength: copy.invalidBodyLength,
              requestBodyTimeout: copy.requestBodyTimeout,
              failed: copy.submitFailed,
            },
            {
              VALIDATION_ERROR: copy.invalidRequest,
              VERIFICATION_ALREADY_VERIFIED: copy.alreadyVerified,
              VERIFICATION_PROFILE_REQUIRED: copy.invalidRequest,
              VERIFICATION_AUTHORITY_CHANGED: copy.conflict,
              VERIFICATION_PROFILE_CHANGED: copy.conflict,
            },
          ),
          code: error.code,
        },
        error.statusCode,
      );
    }

    logRequestEvent({
      level: "error",
      event: "verification.request_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error: copy.submitFailed,
      },
      500,
    );
  }
});
