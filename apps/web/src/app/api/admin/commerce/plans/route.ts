import { AppError, ForbiddenError, UnauthorizedError } from "@nexus/domain";
import { commercialPlanCommandSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { commercialAdminQuery } from "../../../../../lib/commercial-plan-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { commercialPlanService } from "../../../../../lib/services/commercial-plan-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const query = commercialAdminQuery(request.nextUrl.searchParams);
    return commercialPlanService.adminPage(actor, query.page, query.status);
  });
}
export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const token = request.cookies.get("nexus_session")?.value;
    if (!token) throw new UnauthorizedError();
    const expected = request.headers.get("x-nexus-actor-id");
    if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expected !== actor.id) throw new AppError("Account changed", 409, "ACTOR_CHANGED");
    if (actor.role !== "admin") throw new ForbiddenError();
    const parsed = commercialPlanCommandSchema.safeParse(await readBoundedJson(request, 16384));
    if (!parsed.success || parsed.data.action !== "create")
      throw new AppError("Invalid commercial plan", 400, "COMMERCIAL_PLAN_INVALID");
    return {
      ...(await commercialPlanService.command(actor, parsed.data, token)),
      actorId: actor.id,
    };
  });
});
