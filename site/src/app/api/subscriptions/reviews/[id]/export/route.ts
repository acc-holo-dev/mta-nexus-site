import type { NextRequest } from "next/server";
import { planReviewsQuery } from "../../../../../../lib/plan-reviews-query";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { planReviewsService } from "../../../../../../lib/services/plan-reviews-service";
export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const query = planReviewsQuery(request.nextUrl.searchParams, true);
    const report = await planReviewsService.detail(
        actor,
        (await context.params).id,
        query.organizationId,
      ),
      body = JSON.stringify(report);
    if (Buffer.byteLength(body, "utf8") > 32 * 1024)
      throw new RangeError("Review export too large");
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=plan-review.json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
