import { AppError, UnauthorizedError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../../lib/browser-route-adapter";
import { resourceCommerceRequest } from "../../../../../../../lib/resource-commerce-http";
import { storageMaintenanceService } from "../../../../../../../lib/services/storage-maintenance-service";
import {
  storageCleanupSchema,
  storageParse,
} from "../../../../../../../lib/storage-maintenance-query";
export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    return resourceCommerceRequest(request, true, async (actor) => {
      const token = request.cookies.get("nexus_session")?.value;
      if (!token) throw new UnauthorizedError();
      const expected = request.headers.get("x-nexus-actor-id");
      if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
      if (expected !== actor.id) throw new AppError("Account changed", 409, "ACTOR_CHANGED");
      const command = storageParse(storageCleanupSchema, await readBoundedJson(request));
      return {
        ...(await storageMaintenanceService.cleanup(
          actor.id,
          token,
          (
            await params
          ).id,
          command.expectedRevision,
        )),
        actorId: actor.id,
      };
    });
  },
);
