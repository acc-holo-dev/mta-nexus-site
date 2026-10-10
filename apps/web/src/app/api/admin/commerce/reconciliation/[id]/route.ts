import type { NextRequest } from "next/server";
import { ForbiddenError } from "@nexus/domain";
import { financialReviewRepository } from "@nexus/db";
import { financialPageQuery } from "../../../../../../lib/financial-query";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
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
