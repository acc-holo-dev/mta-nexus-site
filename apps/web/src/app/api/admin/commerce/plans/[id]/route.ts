import { AppError, ForbiddenError } from "@nexus/domain";
import { commercialPlanCommandSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { commercialPlanService } from "../../../../../../lib/services/commercial-plan-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const values = request.nextUrl.searchParams.getAll("page"),
      page = values.length ? Number(values[0]) : 1;
    if (
      values.length > 1 ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 1000 ||
      [...request.nextUrl.searchParams.keys()].some((key) => key !== "page")
    )
      throw new AppError("Invalid page", 400, "COMMERCIAL_PLAN_INVALID");
    return commercialPlanService.adminDetail(actor, (await params).id, page);
  });
}
export const POST = withBrowserMutation(function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return resourceCommerceRequest(request, true, async (actor) => {
    if (actor.role !== "admin") throw new ForbiddenError();
    const parsed = commercialPlanCommandSchema.safeParse(await readBoundedJson(request, 16384));
    if (!parsed.success || parsed.data.action === "create")
      throw new AppError("Invalid commercial plan", 400, "COMMERCIAL_PLAN_INVALID");
    return commercialPlanService.command(actor, parsed.data, (await params).id);
  });
});
