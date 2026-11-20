import { financialReviewRepository } from "@nexus/db";
import { ForbiddenError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { financialPageQuery } from "../../../../../../features/commerce/financial-query";
import { resourceCommerceRequest } from "../../../../../../features/resources/resource-commerce-http";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    if (actor.role !== "admin") throw new ForbiddenError();
    return financialReviewRepository.detail(
      actor.id,
      (await params).id,
      financialPageQuery(request.nextUrl.searchParams),
    );
  });
}
