import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { resourceReviewCreateSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import {
  resourceReviewCopy,
  resourceReviewError,
} from "../../../../../features/resources/resource-review-i18n";
import { resourceReviewQuery } from "../../../../../features/resources/resource-review-query";
import { getTrustedRequestIp } from "../../../../../features/shell/request-client-ip";
import { readBoundedJson } from "../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../lib/http/browser-route-adapter";
import { resolveLocale } from "../../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../../lib/platform/observability";
import { resourceReviewService } from "../../../../../lib/services/resources/resource-review-service";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = createRequestLogContext(request);
  const headers = { "Cache-Control": "no-store" };
  const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
  const copy = resourceReviewCopy(locale);
  try {
    const query = resourceReviewQuery(request.nextUrl.searchParams);
    const ip = getTrustedRequestIp(request);
    if (!(await consumeRateLimit("resourceInspection", `review-ip:${ip}`)).success)
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
        { code: error.code, error: resourceReviewError(locale, error.code) },
        { status: error.statusCode, headers },
      );
    logRequestEvent({
      level: "error",
      event: "product.reviews_fetch_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(
      context,
      { code: "REVIEWS_UNAVAILABLE", error: copy.pageUnavailable },
      { status: 503, headers },
    );
  }
}
export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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
  },
);
