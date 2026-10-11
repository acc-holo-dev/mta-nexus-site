import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { resourceCommerceRequest } from "./resource-commerce-http";
import { parseBuildPackageQuery } from "./build-package-query";
import { buildPackageService } from "./services/build-package-service";
export function buildPackageFilesRequest(
  request: NextRequest,
  params: Promise<{ id: string; buildId: string }>,
  staff = false,
) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const query = parseBuildPackageQuery(request.nextUrl.searchParams);
    if (!query) throw new AppError("Invalid package query", 400, "BUILD_PACKAGE_QUERY_INVALID");
    const { id, buildId } = await params;
    return buildPackageService.page(actor, id, buildId, query, staff);
  });
}
