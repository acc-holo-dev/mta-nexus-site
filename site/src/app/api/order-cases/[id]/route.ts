import type { NextRequest } from "next/server";
import { orderCaseQuery } from "../../../../features/commerce/order-case-query";
import { resourceCommerceRequest } from "../../../../features/resources/resource-commerce-http";
import { orderCaseService } from "../../../../lib/services/commerce/order-case-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    orderCaseService.detail(
      (await params).id,
      actor,
      false,
      orderCaseQuery(request.nextUrl.searchParams).page,
    ),
  );
}
