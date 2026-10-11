import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../../../../lib/resource-commerce-http";
import { storageMaintenanceService } from "../../../../../../../lib/services/storage-maintenance-service";
import {
  storageCleanupSchema,
  storageParse,
} from "../../../../../../../lib/storage-maintenance-query";
export function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const command = storageParse(storageCleanupSchema, await readBoundedJson(request));
    return storageMaintenanceService.cleanup(actor.id, (await params).id, command.expectedRevision);
  });
}
