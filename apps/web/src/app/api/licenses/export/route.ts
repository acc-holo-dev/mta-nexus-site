import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { licenseArchiveQuery } from "../../../../lib/license-archive-query";
import { licenseArchiveCsv } from "../../../../lib/license-archive-csv";
import { licenseControlService } from "../../../../lib/services/license-control-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const result = await licenseControlService.archive(
      actor,
      licenseArchiveQuery(request.nextUrl.searchParams),
    );
    return new Response(licenseArchiveCsv(result.licenses), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="licenses-page-${result.page}.csv"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
