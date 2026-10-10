import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { orderOperationsService } from "../../../../../lib/services/commercial-plan-service";
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
      throw new AppError("Invalid page", 400, "ORDER_OPERATION_INVALID");
    return orderOperationsService.detail(actor, (await params).id, page);
  });
}
