import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { parseHistoryPage } from "../../../../../lib/commerce-history-format";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { licenseControlService } from "../../../../../lib/services/license-control-service";

export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (user) => {
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== user.id) throw new AppError("Account changed", 409, "ACTOR_CHANGED");
    return {
      ...(await licenseControlService.servers(
        user,
        (
          await context.params
        ).id,
        parseHistoryPage(request.nextUrl.searchParams.get("page") ?? undefined),
      )),
      actorId: user.id,
    };
  });
}
