import type { NextRequest } from "next/server";
import { withBrowserMutation } from "../../../../../../../lib/browser-route-adapter";
import { readBoundedJson } from "../../../../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../../../../lib/resource-commerce-http";
import { storageMaintenanceService } from "../../../../../../../lib/services/storage-maintenance-service";
import {
  storageCleanupSchema,
  storageParse,
} from "../../../../../../../lib/storage-maintenance-query";
export const POST = withBrowserMutation((
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  return resourceCommerceRequest(request, true, async (actor) => {
    const command = storageParse(storageCleanupSchema, await readBoundedJson(request));
    return storageMaintenanceService.cleanup(actor.id, (await params).id, command.expectedRevision);
  });
});
