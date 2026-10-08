import type { NextRequest } from "next/server";
import { claimResourceSchema } from "@nexus/validation";
import { consumeRateLimit } from "@nexus/security";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../lib/observability";
import { getTrustedRequestIp } from "../../../../lib/request-client-ip";
import { authService } from "../../../../lib/services/auth-service";
import { commerceService } from "../../../../lib/services/commerce-service";

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

export async function POST(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const ip = getTrustedRequestIp(request);
    const rateLimit = await consumeRateLimit(
      "resourceClaim",
      ip,
    );
    if (!rateLimit.success) {
      return json(
        context,
        {
          error:
            "Too many resource claims. Please try again later.",
        },
        429,
      );
    }

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

    const parsed = claimResourceSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return json(
        context,
        {
          error: "Invalid resource claim",
          details: parsed.error.format(),
        },
        400,
      );
    }

    const result =
      await commerceService.claimFreeResource({
        user,
        productId: parsed.data.productId,
      });

    return json(
      context,
      result,
      result.alreadyClaimed ? 200 : 201,
    );
  } catch (error: unknown) {
    const appError =
      error instanceof Error &&
      "statusCode" in error
        ? (error as Error & {
            statusCode: number;
          })
        : null;
    logRequestEvent({
      level: "error",
      event: "resource.claim_failed",
      context,
      status: appError?.statusCode || 500,
      error,
    });
    return json(
      context,
      {
        error:
          appError?.message ||
          "Resource claim failed",
      },
      appError?.statusCode || 500,
    );
  }
}
