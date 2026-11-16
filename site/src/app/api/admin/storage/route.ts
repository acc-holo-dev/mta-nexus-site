import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { storageMaintenanceService } from "../../../../lib/services/storage-maintenance-service";
import { storageQuery } from "../../../../lib/storage-maintenance-query";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) => {
    const query = storageQuery(request.nextUrl.searchParams);
    return storageMaintenanceService.list(actor.id, query.page, query.view);
  });
}
