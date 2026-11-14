import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceDeliveryId } from "../../../../../lib/resource-deliveries-query";
import { resourceDeliveriesService } from "../../../../../lib/services/resource-deliveries-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    resourceDeliveriesService.detail(actor, resourceDeliveryId((await params).id)),
  );
}
