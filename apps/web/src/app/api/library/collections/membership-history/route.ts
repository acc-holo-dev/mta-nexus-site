import type { NextRequest } from "next/server";
import { libraryMembershipHistoryQuery } from "../../../../../lib/library-membership-history-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { libraryCollectionsService } from "../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    libraryCollectionsService.membershipHistory(
      actor,
      libraryMembershipHistoryQuery(request.nextUrl.searchParams),
    ),
  );
}
