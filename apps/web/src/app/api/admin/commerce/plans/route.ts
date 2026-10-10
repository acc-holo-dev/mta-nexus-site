import type { NextRequest } from "next/server";
import { AppError, ForbiddenError } from "@nexus/domain";
import { commercialPlanCommandSchema } from "@nexus/validation";
import { commercialAdminQuery } from "../../../../../lib/commercial-plan-query";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { commercialPlanService } from "../../../../../lib/services/commercial-plan-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const query = commercialAdminQuery(request.nextUrl.searchParams);
    return commercialPlanService.adminPage(actor, query.page, query.status);
  });
}
export function POST(request: NextRequest) {
  return resourceCommerceRequest(request, true, async (actor) => {
    if (actor.role !== "admin") throw new ForbiddenError();
    const parsed = commercialPlanCommandSchema.safeParse(await readBoundedJson(request, 16384));
    if (!parsed.success || parsed.data.action !== "create")
      throw new AppError("Invalid commercial plan", 400, "COMMERCIAL_PLAN_INVALID");
    return commercialPlanService.command(actor, parsed.data);
  });
}
