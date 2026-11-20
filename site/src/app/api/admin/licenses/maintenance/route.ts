import type { NextRequest } from "next/server";
import { licenseRuntimePage } from "../../../../../features/commerce/license-runtime-query";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { licenseControlService } from "../../../../../lib/services/commerce/license-control-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    licenseControlService.maintenance(actor, licenseRuntimePage(request.nextUrl.searchParams)),
  );
}
