import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { storageMaintenanceService } from "../../../../../../lib/services/storage-maintenance-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    storageMaintenanceService.detail(actor.id, (await params).id),
  );
}
