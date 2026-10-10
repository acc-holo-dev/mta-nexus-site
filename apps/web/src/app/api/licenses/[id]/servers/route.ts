import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { parseHistoryPage } from "../../../../../lib/commerce-history-format";
import { licenseControlService } from "../../../../../lib/services/license-control-service";

export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (user) =>
    licenseControlService.servers(
      user,
      (await context.params).id,
      parseHistoryPage(request.nextUrl.searchParams.get("page") ?? undefined),
    ),
  );
}
