import type { NextRequest } from "next/server";
import { commercialQuoteQuery } from "../../../../features/commerce/commercial-plan-query";
import { commercialPublicRequest } from "../../../../features/commerce/commercial-public-http";
import { commercialPlanService } from "../../../../lib/services/commercial-plan-service";
export function GET(request: NextRequest) {
  return commercialPublicRequest(request, async () => {
    const query = commercialQuoteQuery(request.nextUrl.searchParams);
    return commercialPlanService.estimate(
      query.amount,
      query.currency,
      query.planId,
      query.revision,
    );
  });
}
