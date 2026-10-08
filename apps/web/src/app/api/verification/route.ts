import { after, type NextRequest } from "next/server";
import {
  organizationRepository,
  userRepository,
  verificationRepository,
} from "@nexus/db";
import { AppError } from "@nexus/domain";
import {
  consumeRateLimit,
  generateId,
} from "@nexus/security";
import { z } from "zod";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../lib/observability";
import { authService } from "../../../lib/services/auth-service";
import { dispatchNotificationsBestEffort } from "../../../lib/services/notification-dispatch-service";

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

const verificationRequestSchema = z
  .object({
    targetType: z.enum([
      "user",
      "developer",
      "organization",
      "server",
    ]),
    targetId: z.string().min(1).max(128),
    proofUrl: z
      .string()
      .url()
      .regex(/^https?:\/\//iu)
      .max(2048)
      .optional()
      .or(z.literal("")),
    notes: z.string().max(1000).optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const token =
      request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return json(
        context,
        { error: "Unauthorized" },
        401,
      );
    }

    const requests =
      await verificationRepository.listByRequester(
        user.id,
      );
    return json(context, { requests });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event:
        "verification.history_fetch_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error:
          "Failed to load verification requests",
      },
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const token =
      request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return json(
        context,
        { error: "Authentication required" },
        401,
      );
    }

    const rateLimit = await consumeRateLimit(
      "verification",
      user.id,
    );
    if (!rateLimit.success) {
      return json(
        context,
        {
          error:
            "Too many verification requests. Please try again tomorrow.",
        },
        429,
      );
    }

    const body = await request
      .json()
      .catch(() => null);
    const parsed =
      verificationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return json(
        context,
        {
          error:
            "Invalid verification request",
          details: parsed.error.format(),
        },
        400,
      );
    }

    if (
      parsed.data.targetType === "server"
    ) {
      return json(
        context,
        {
          error:
            "Server ownership verification requires the MTA control challenge flow.",
          code:
            "SERVER_CONTROL_CHALLENGE_REQUIRED",
        },
        422,
      );
    }

    let targetIsVerified = false;

    if (
      parsed.data.targetType === "user" ||
      parsed.data.targetType === "developer"
    ) {
      if (
        parsed.data.targetId !== user.id
      ) {
        return json(
          context,
          {
            error:
              "You can only verify your own profile",
          },
          403,
        );
      }
      targetIsVerified = user.isVerified;
    } else {
      const organization =
        await organizationRepository.findById(
          parsed.data.targetId,
        );
      if (!organization) {
        return json(
          context,
          {
            error:
              "Organization was not found",
          },
          404,
        );
      }

      const memberships =
        await organizationRepository.listUserMemberships(
          user.id,
        );
      const membership = memberships.find(
        (candidate) =>
          candidate.organizationId ===
          organization.id,
      );

      if (
        organization.ownerId !== user.id &&
        (!membership ||
          (membership.role !== "owner" &&
            membership.role !== "admin"))
      ) {
        return json(
          context,
          {
            error:
              "You do not manage this organization",
          },
          403,
        );
      }

      targetIsVerified =
        organization.isVerified;
    }

    if (targetIsVerified) {
      return json(
        context,
        {
          error:
            "This target is already verified",
        },
        409,
      );
    }

    const duplicate =
      await verificationRepository.findPendingForTarget(
        user.id,
        parsed.data.targetType,
        parsed.data.targetId,
      );
    if (duplicate) {
      return json(
        context,
        {
          error:
            "A verification request is already pending",
          requestId: duplicate.id,
        },
        409,
      );
    }

    const verificationRequest =
      await verificationRepository.createRequest(
        {
          requesterId: user.id,
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
          proofUrl:
            parsed.data.proofUrl || undefined,
          notes: parsed.data.notes,
        },
        {
          id: generateId("aud"),
          actorId: user.id,
          actorType: "user",
          action: "verification.requested",
          details: {
            targetType:
              parsed.data.targetType,
            targetId: parsed.data.targetId,
          },
        },
      );

    after(async () => {
      try {
        const moderatorIds =
          await userRepository.listModeratorIds();
        const dispatch =
          await dispatchNotificationsBestEffort(
            moderatorIds.map(
              (moderatorId) => ({
                recipientId: moderatorId,
                title:
                  "New verification request",
                message:
                  parsed.data.targetType +
                  " verification requested for " +
                  parsed.data.targetId,
                link:
                  "/admin?verificationView=pending&verificationPage=1",
                type: "security" as const,
              }),
            ),
          );

        if (dispatch.storageFailed) {
          logRequestEvent({
            level: "warn",
            event:
              "verification.moderator_notification_partial_failure",
            context,
            status: 201,
            fields: {
              storageFailed:
                dispatch.storageFailed,
            },
          });
        }
      } catch (error) {
        logRequestEvent({
          level: "warn",
          event:
            "verification.moderator_notification_failed",
          context,
          status: 201,
          error,
        });
      }
    });

    return json(
      context,
      {
        success: true,
        request: verificationRequest,
      },
      201,
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return json(
        context,
        {
          error: error.message,
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
        error:
          "Failed to submit verification request",
      },
      500,
    );
  }
}
