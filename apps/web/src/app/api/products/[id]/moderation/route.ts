import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceControlPageQuery } from "../../../../../lib/resource-release-control-query";
import { resourceModerationService } from "../../../../../lib/services/resource-release-control-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    resourceModerationService.publisherHistory(
      actor,
      (await params).id,
      resourceControlPageQuery(request.nextUrl.searchParams),
    ),
  );
}
