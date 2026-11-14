import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourcePublisherHistoryQuery } from "../../../../../lib/resource-publisher-query";
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
