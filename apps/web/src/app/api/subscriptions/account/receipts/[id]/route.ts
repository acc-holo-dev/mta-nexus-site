import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { subscriptionsService } from "../../../../../../lib/services/subscriptions-service";
import { subscriptionsQuery } from "../../../../../../lib/subscriptions-query";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    subscriptionsService.detail(
      actor,
      (await params).id,
      subscriptionsQuery(request.nextUrl.searchParams).organizationId,
    ),
  );
}
