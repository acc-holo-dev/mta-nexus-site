import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { serverReviewCommandSchema, serverReviewCreateSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../../lib/observability";
import { getTrustedRequestIp } from "../../../../../lib/request-client-ip";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { serverReviewQuery } from "../../../../../lib/server-review-query";
import { serverReviewService } from "../../../../../lib/services/server-review-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = createRequestLogContext(request);
  const headers = { "Cache-Control": "no-store" };
  try {
    const query = serverReviewQuery(request.nextUrl.searchParams);
    const ip = getTrustedRequestIp(request);
    if (
      ip !== "unknown" &&
      !(await consumeRateLimit("resourceInspection", `server-review-ip:${ip}`)).success
    ) {
      throw new RateLimitExceededError();
    }
    return jsonWithRequestId(
      context,
      await serverReviewService.publicPage((await params).id, query.page),
      { headers },
    );
  } catch (error) {
    if (error instanceof AppError) {
      return jsonWithRequestId(
        context,
        { code: error.code },
        { status: error.statusCode, headers },
      );
    }
    if (error instanceof Error && /Ambiguous|Invalid review page/u.test(error.message)) {
      return jsonWithRequestId(context, { code: "REVIEW_INVALID" }, { status: 400, headers });
    }
    logRequestEvent({
      level: "error",
      event: "server.reviews_fetch_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(context, { code: "REVIEWS_UNAVAILABLE" }, { status: 503, headers });
  }
}

export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
    resourceCommerceRequest(request, true, async (actor) => {
      const raw = await readBoundedJson(request, 16384);
      const create = serverReviewCreateSchema.safeParse(raw);
      const parsed = create.success
        ? {
            success: true as const,
            data: { action: "save" as const, expectedRevision: 0, ...create.data },
          }
        : serverReviewCommandSchema.safeParse(raw);
      if (!parsed.success) throw new AppError("Invalid review", 400, "REVIEW_INVALID");
      const result = await serverReviewService.command(actor, (await params).id, parsed.data);
      return Response.json(
        { success: true, ...result },
        { status: parsed.data.action === "save" ? 201 : 200 },
      );
    }),
);
