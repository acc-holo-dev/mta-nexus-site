import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { publisherDeliveriesQuery } from "../../../../../features/resources/resource-deliveries-query";
import { resourceDeliveriesService } from "../../../../../lib/services/commerce/resource-deliveries-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    resourceDeliveriesService.publisher(
      actor,
      (await params).id,
      publisherDeliveriesQuery(request.nextUrl.searchParams),
    ),
  );
}
