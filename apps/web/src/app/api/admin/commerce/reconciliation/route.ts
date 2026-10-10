import type { NextRequest } from "next/server";
import { ForbiddenError } from "@nexus/domain";
import { financialReviewRepository } from "@nexus/db";
import { financialReviewQuery } from "../../../../../lib/financial-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) => {
    if (actor.role !== "admin") throw new ForbiddenError();
    const query = financialReviewQuery(request.nextUrl.searchParams);
    return financialReviewRepository.page(actor.id, query.page, query.filter);
  });
}
