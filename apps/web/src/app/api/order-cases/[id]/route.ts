import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { orderCaseService } from "../../../../lib/services/order-case-service";
import { orderCaseQuery } from "../../../../lib/order-case-query";
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
