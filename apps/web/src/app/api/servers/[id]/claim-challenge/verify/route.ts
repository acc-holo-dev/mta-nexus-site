import { after, type NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { z } from "zod";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../../../lib/observability";
import { authService } from "../../../../../../lib/services/auth-service";
import {
  notifyModeratorsOfServerClaim,
  serverClaimService,
} from "../../../../../../lib/services/server-claim-service";

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

const verifySchema = z
  .object({
    challengeId: z
      .string()
      .regex(/^scc_[0-9a-f-]{36}$/u)
      .max(64),
    token: z
      .string()
      .regex(/^NXCLAIM-[A-F0-9]{24}$/u),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = createRequestLogContext(request);
  try {
    const sessionToken =
      request.cookies.get("nexus_session")?.value;
    const user =
      await authService.getSession(sessionToken);
    if (!user) {
      return json(
        context,
        { error: "Authentication required" },
        401,
      );
    }

    const rateLimit = await consumeRateLimit(
      "serverClaimProof",
      user.id,
    );
    if (!rateLimit.success) {
      return json(
        context,
        {
          error:
            "Too many server control proof attempts",
        },
        429,
      );
    }

    const parsed = verifySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return json(
        context,
        {
          error:
            "Invalid server control proof",
        },
        400,
      );
    }

    const { id: serverId } = await params;
    if (!serverId || serverId.length > 128) {
      return json(
        context,
        { error: "Server not found" },
        404,
      );
    }

    const {
      moderatorNotification,
      ...result
    } = await serverClaimService.verifyChallenge(
      {
        serverId,
        challengeId: parsed.data.challengeId,
        token: parsed.data.token,
      },
      user,
    );

    after(async () => {
      try {
        await notifyModeratorsOfServerClaim(
          moderatorNotification.serverName,
        );
      } catch (error) {
        logRequestEvent({
          level: "warn",
          event:
            "server.claim_challenge.notification_failed",
          context,
          status: 201,
          error,
        });
      }
    });

    return json(context, result, 201);
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
      event:
        "server.claim_challenge.verify_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error:
          "Could not verify server control",
      },
      500,
    );
  }
}
