import type { NextRequest } from "next/server";
import { subscriptionsQuery } from "../../../../../../features/commerce/subscriptions-query";
import { resourceCommerceRequest } from "../../../../../../features/resources/resource-commerce-http";
import { subscriptionsService } from "../../../../../../lib/services/commerce/subscriptions-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    subscriptionsService.detail(
      actor,
      (await params).id,
      subscriptionsQuery(request.nextUrl.searchParams).organizationId,
    ),
  );
}
