import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../../lib/resource-commerce-http";
import { subscriptionsService } from "../../../../../../../lib/services/subscriptions-service";
import { subscriptionsQuery } from "../../../../../../../lib/subscriptions-query";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const detail = await subscriptionsService.detail(
        actor,
        (await params).id,
        subscriptionsQuery(request.nextUrl.searchParams).organizationId,
      ),
      body = JSON.stringify({ format: "nexus-subscription-receipt-v1", ...detail }, null, 2);
    if (new TextEncoder().encode(body).byteLength > 32 * 1024)
      throw new AppError("Export limit exceeded", 409, "SUBSCRIPTION_EXPORT_LIMIT");
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="subscription-${detail.receipt.id}.json"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
