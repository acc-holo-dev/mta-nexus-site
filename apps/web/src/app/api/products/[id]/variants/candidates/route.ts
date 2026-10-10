import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { resourceManagementService } from "../../../../../../lib/services/resource-management-service";

export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const { id } = await params;
    const values = request.nextUrl.searchParams.getAll("page");
    const page = values.length === 0 ? 1 : Number(values[0]);
    if (values.length > 1 || !Number.isSafeInteger(page) || page < 1 || page > 1000)
      throw new AppError("Invalid candidate page", 400, "RESOURCE_VARIANTS_INVALID");
    return resourceManagementService.variantCandidates(id, actor, page);
  });
}
