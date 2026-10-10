import type { NextRequest } from "next/server";
import { commercialPublicRequest } from "../../../../lib/commercial-public-http";
import { commercialQuoteQuery } from "../../../../lib/commercial-plan-query";
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
