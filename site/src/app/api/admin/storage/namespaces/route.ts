import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { storageMaintenanceService } from "../../../../../lib/services/storage-maintenance-service";
import { storageOffset } from "../../../../../lib/storage-maintenance-query";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Account changed", 409, "ACTOR_CHANGED");
    return {
      ...(await storageMaintenanceService.namespaces(
        actor.id,
        storageOffset(request.nextUrl.searchParams),
        request.signal,
      )),
      actorId: actor.id,
    };
  });
}
