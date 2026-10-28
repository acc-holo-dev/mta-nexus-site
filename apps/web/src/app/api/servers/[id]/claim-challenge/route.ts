import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../../lib/observability";
import { authService } from "../../../../../lib/services/auth-service";
import { serverClaimService } from "../../../../../lib/services/server-claim-service";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";

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
    try {
      const token = request.cookies.get("nexus_session")?.value;
      const user = await authService.getSession(token);
      if (!user) {
        return json(context, { error: "Authentication required" }, 401);
      }

      const rateLimit = await consumeRateLimit("serverClaimProof", user.id);
      if (!rateLimit.success) {
        return json(
          context,
          {
            error: "Too many server control proof attempts",
          },
          429,
        );
      }

      const { id: serverId } = await params;
      if (!serverId || serverId.length > 128) {
        return json(context, { error: "Server not found" }, 404);
      }

      const challenge = await serverClaimService.issueChallenge(serverId, user);

      return json(
        context,
        {
          challenge,
          instruction:
            "Temporarily add the exact token to the MTA server name, keep the server visible in the official master-list, then verify control before the challenge expires.",
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
        event: "server.claim_challenge.create_failed",
        context,
        status: 500,
        error,
      });
      return json(
        context,
        {
          error: "Could not create server control challenge",
        },
        500,
      );
    }
  },
);
