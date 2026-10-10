import type { NextRequest } from "next/server";
import { financialStatementsRepository } from "@nexus/db";
import { financialStatementQuery } from "../../../lib/financial-query";
import { resourceCommerceRequest } from "../../../lib/resource-commerce-http";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) => {
    const query = financialStatementQuery(request.nextUrl.searchParams);
    return financialStatementsRepository.statement(
      actor.id,
      query.page,
      query.currency,
      query.organizationId,
    );
  });
}
