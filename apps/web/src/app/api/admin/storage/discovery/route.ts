import type { NextRequest } from "next/server";
import { UnauthorizedError } from "@nexus/domain";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { storageMaintenanceService } from "../../../../../lib/services/storage-maintenance-service";
import { storageDiscoverySchema, storageParse } from "../../../../../lib/storage-maintenance-query";
export const POST = withBrowserMutation((request: NextRequest) => {
  return resourceCommerceRequest(request, true, async (actor) => {
    const token = request.cookies.get("nexus_session")?.value;
    if (!token) throw new UnauthorizedError();
    const command = storageParse(storageDiscoverySchema, await readBoundedJson(request));
    return storageMaintenanceService.discover(
      actor.id,
      token,
      command.ownerId,
      command.offset,
      request.signal,
    );
  });
});
