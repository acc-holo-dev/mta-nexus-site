import type { NextRequest } from "next/server";
import { resourcePublisherHistoryQuery } from "../../../../../features/resources/resource-publisher-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourcePublisherService } from "../../../../../lib/services/resource-publisher-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    resourcePublisherService.history(
      actor,
      (await params).id,
      resourcePublisherHistoryQuery(request.nextUrl.searchParams),
    ),
  );
}
