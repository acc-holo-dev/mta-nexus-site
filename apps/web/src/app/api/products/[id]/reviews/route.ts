import type { NextRequest } from "next/server";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { getTrustedRequestIp } from "../../../../../lib/request-client-ip";
import { resourceReviewCreateSchema } from "@nexus/validation";
import { resourceReviewService } from "../../../../../lib/services/resource-review-service";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceReviewQuery } from "../../../../../lib/resource-review-query";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../../lib/observability";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = createRequestLogContext(request);
  const headers = { "Cache-Control": "no-store" };
  try {
    const query = resourceReviewQuery(request.nextUrl.searchParams);
    const ip = getTrustedRequestIp(request);
    if (ip !== "unknown" && !(await consumeRateLimit("resourceInspection", `review-ip:${ip}`)).success)
      throw new RateLimitExceededError();
    return jsonWithRequestId(
      context,
      await resourceReviewService.publicPage((await params).id, query.page),
      { headers },
    );
  } catch (error) {
    if (error instanceof AppError)
      return jsonWithRequestId(
        context,
        { code: error.code },
        { status: error.statusCode, headers },
      );
    logRequestEvent({
      level: "error",
      event: "product.reviews_fetch_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(context, { code: "REVIEWS_UNAVAILABLE" }, { status: 503, headers });
  }
}
export const POST = withBrowserMutation((request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  return resourceCommerceRequest(request, true, async (actor) => {
    const body = resourceReviewCreateSchema.safeParse(await readBoundedJson(request, 16384));
    if (!body.success) throw new AppError("Invalid review", 400, "REVIEW_INVALID");
    const result = await resourceReviewService.command(actor, (await params).id, {
      action: "save",
      expectedRevision: 0,
      ...body.data,
    });
    return Response.json(
      {
        success: true,
        ...result,
        newRating: { ratingCount: result.ratingCount, ratingAverage: result.ratingAverage },
      },
      { status: 201 },
    );
  });
});
