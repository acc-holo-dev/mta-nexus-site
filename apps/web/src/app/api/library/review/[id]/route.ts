import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { resourceReviewCommandSchema } from "@nexus/validation";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceReviewService } from "../../../../../lib/services/resource-review-service";
import { readBoundedJson } from "../../../../../lib/bounded-json";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    resourceReviewService.ownDetail(actor, (await params).id),
  );
}
export function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const body = resourceReviewCommandSchema.safeParse(await readBoundedJson(request, 16384));
    if (!body.success) throw new AppError("Invalid review", 400, "REVIEW_INVALID");
    return resourceReviewService.command(actor, (await params).id, body.data);
  });
}
