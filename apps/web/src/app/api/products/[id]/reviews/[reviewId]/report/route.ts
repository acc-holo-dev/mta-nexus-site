import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { resourceReviewReportSchema } from "@nexus/validation";
import { resourceCommerceRequest } from "../../../../../../../lib/resource-commerce-http";
import { resourceReviewService } from "../../../../../../../lib/services/resource-review-service";
import { readBoundedJson } from "../../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../../lib/browser-route-adapter";
export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string; reviewId: string }> }) => {
    return resourceCommerceRequest(request, true, async (actor) => {
      const body = resourceReviewReportSchema.safeParse(await readBoundedJson(request, 8192));
      if (!body.success) throw new AppError("Invalid review report", 400, "REVIEW_REPORT_INVALID");
      const target = await params;
      return resourceReviewService.report(actor, target.id, target.reviewId, body.data);
    });
  },
);
