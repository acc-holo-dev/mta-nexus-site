import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { libraryMembershipHistoryQuery } from "../../../../../lib/library-membership-history-query";
import { libraryCollectionsService } from "../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    libraryCollectionsService.membershipHistory(
      actor,
      libraryMembershipHistoryQuery(request.nextUrl.searchParams),
    ),
  );
}
