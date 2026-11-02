import { financialStatementsRepository } from "@nexus/db";
import type { NextRequest } from "next/server";
import { financialPageQuery } from "../../../../lib/financial-query";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    financialStatementsRepository.scopes(
      actor.id,
      financialPageQuery(request.nextUrl.searchParams),
    ),
  );
}
