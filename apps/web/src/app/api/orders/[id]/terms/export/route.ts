import type { NextRequest } from "next/server";
import { orderTermsPageQuery } from "../../../../../../lib/order-terms-query";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { orderTermsService } from "../../../../../../lib/services/order-terms-service";
export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const report = await orderTermsService.report(
      actor,
      (await context.params).id,
      "buyer",
      orderTermsPageQuery(request.nextUrl.searchParams),
    );
    const body = JSON.stringify(report);
    if (Buffer.byteLength(body, "utf8") > 128 * 1024)
      throw new RangeError("Order terms export too large");
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="order-terms-page-${report.page}.json"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
