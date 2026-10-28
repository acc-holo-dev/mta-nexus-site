import { UnauthorizedError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { subscriptionsService } from "../../../../lib/services/subscriptions-service";
import { subscriptionsQuery } from "../../../../lib/subscriptions-query";
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
    subscriptionsQuery(request.nextUrl.searchParams, "empty");
    return subscriptionsService.command(actor, await readBoundedJson(request, 4096), token);
  });
});
