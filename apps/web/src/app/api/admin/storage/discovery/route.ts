import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { storageMaintenanceService } from "../../../../../lib/services/storage-maintenance-service";
import { storageDiscoverySchema, storageParse } from "../../../../../lib/storage-maintenance-query";
export function POST(request: NextRequest) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const command = storageParse(storageDiscoverySchema, await readBoundedJson(request));
    return storageMaintenanceService.discover(
      actor.id,
      command.ownerId,
      command.offset,
      request.signal,
    );
  });
}
