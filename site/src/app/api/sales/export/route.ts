import type { NextRequest } from "next/server";
import { sellerSalesCsv } from "../../../../features/commerce/seller-sales-csv";
import { sellerSalesQuery } from "../../../../features/commerce/seller-sales-query";
import { resourceCommerceRequest } from "../../../../features/resources/resource-commerce-http";
import { sellerSalesService } from "../../../../lib/services/commerce/seller-sales-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const report = await sellerSalesService.report(
      actor,
      sellerSalesQuery(request.nextUrl.searchParams),
    );
    return new Response(sellerSalesCsv(report.sales, report.observedAt), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="seller-sales-page-${report.page}.csv"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
