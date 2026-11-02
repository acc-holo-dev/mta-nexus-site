import type { NextRequest } from "next/server";
import { licenseRuntimePage } from "../../../../../lib/license-runtime-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { licenseControlService } from "../../../../../lib/services/license-control-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    licenseControlService.maintenance(actor, licenseRuntimePage(request.nextUrl.searchParams)),
  );
}
