import { AppError, ForbiddenError } from "@nexus/domain";
import { resourceReviewDecisionSchema } from "@nexus/validation";
import { readBoundedJson } from "../../../../../../lib/bounded-json";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { resourceReviewService } from "../../../../../../lib/services/resource-review-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    resourceReviewService.reportDetail(actor, true, (await params).id),
  );
}
export function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, true, async (actor) => {
    if (actor.role !== "admin" && actor.role !== "moderator") throw new ForbiddenError();
    const body = resourceReviewDecisionSchema.safeParse(await readBoundedJson(request, 16384));
    if (!body.success)
      throw new AppError("Invalid review report decision", 400, "REVIEW_REPORT_INVALID");
    return resourceReviewService.decide(actor, (await params).id, body.data);
  });
}
