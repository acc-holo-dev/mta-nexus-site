import { AppError, UnauthorizedError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { subscriptionsQuery } from "../../../../features/commerce/subscriptions-query";
import { resourceCommerceRequest } from "../../../../features/resources/resource-commerce-http";
import { readBoundedJson } from "../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";
import { subscriptionsService } from "../../../../lib/services/commerce/subscriptions-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) =>
    subscriptionsService.dashboard(
      actor,
      subscriptionsQuery(request.nextUrl.searchParams).organizationId,
    ),
  );
}
export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const token = request.cookies.get("nexus_session")?.value;
    if (!token) throw new UnauthorizedError();
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Account changed", 409, "ACTOR_CHANGED");
    subscriptionsQuery(request.nextUrl.searchParams, "empty");
    return subscriptionsService.command(actor, await readBoundedJson(request, 4096), token);
  });
});
