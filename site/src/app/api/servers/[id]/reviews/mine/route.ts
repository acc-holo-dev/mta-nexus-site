import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { serverReviewService } from "../../../../../../lib/services/server-review-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    serverReviewService.ownDetail(actor, (await params).id),
  );
}
