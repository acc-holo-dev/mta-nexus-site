import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { resourceDeliveryId } from "../../../../../features/resources/resource-deliveries-query";
import { resourceDeliveriesService } from "../../../../../lib/services/commerce/resource-deliveries-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    resourceDeliveriesService.detail(actor, resourceDeliveryId((await params).id)),
  );
}
