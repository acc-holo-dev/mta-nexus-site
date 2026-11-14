import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { resourceReviewService } from "../../../../lib/services/resource-review-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    resourceReviewService.reportDetail(actor, false, (await params).id),
  );
}
