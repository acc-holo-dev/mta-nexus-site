import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { storageMaintenanceService } from "../../../../../lib/services/storage-maintenance-service";
import { storageOffset } from "../../../../../lib/storage-maintenance-query";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    storageMaintenanceService.namespaces(
      actor.id,
      storageOffset(request.nextUrl.searchParams),
      request.signal,
    ),
  );
}
