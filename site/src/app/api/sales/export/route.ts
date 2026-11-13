import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { sellerSalesCsv } from "../../../../lib/seller-sales-csv";
import { sellerSalesQuery } from "../../../../lib/seller-sales-query";
import { sellerSalesService } from "../../../../lib/services/seller-sales-service";
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
