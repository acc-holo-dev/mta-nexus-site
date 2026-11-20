import { financialStatementsRepository } from "@nexus/db";
import type { NextRequest } from "next/server";
import { financialPageQuery } from "../../../../features/commerce/financial-query";
import { resourceCommerceRequest } from "../../../../features/resources/resource-commerce-http";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    financialStatementsRepository.scopes(
      actor.id,
      financialPageQuery(request.nextUrl.searchParams),
    ),
  );
}
