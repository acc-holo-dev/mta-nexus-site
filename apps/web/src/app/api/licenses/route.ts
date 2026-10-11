import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../lib/resource-commerce-http";
import { licenseArchiveQuery } from "../../../lib/license-archive-query";
import { licenseControlService } from "../../../lib/services/license-control-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    licenseControlService.archive(actor, licenseArchiveQuery(request.nextUrl.searchParams)),
  );
}
