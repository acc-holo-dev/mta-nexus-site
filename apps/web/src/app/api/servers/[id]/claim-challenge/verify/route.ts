import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { z } from "zod";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../../lib/bounded-json";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../../../lib/observability";
import { authService } from "../../../../../../lib/services/auth-service";
import { serverClaimService } from "../../../../../../lib/services/server-claim-service";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";

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
    try {
      const sessionToken = request.cookies.get("nexus_session")?.value;
      const user = await authService.getSession(sessionToken);
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

      requireServerJsonContentType(request);
      const parsed = verifySchema.safeParse(await readBoundedJson(request));
      if (!parsed.success) {
        return json(
          context,
          {
            error: "Invalid server control proof",
          },
          400,
        );
      }

      const { id: serverId } = await params;
      if (!serverId || serverId.length > 128) {
        return json(context, { error: "Server not found" }, 404);
      }

      // Moderator inbox fanout is committed with the verification request.
      const result = await serverClaimService.verifyChallenge(
        {
          serverId,
          challengeId: parsed.data.challengeId,
          token: parsed.data.token,
        },
        user,
      );

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
        event: "server.claim_challenge.verify_failed",
        context,
        status: 500,
        error,
      });
      return json(
        context,
        {
          error: "Could not verify server control",
        },
        500,
      );
    }
  },
);
