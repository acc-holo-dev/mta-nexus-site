import type { NextRequest } from "next/server";
import { licenseRuntimePage } from "../../../../../lib/license-runtime-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { licenseControlService } from "../../../../../lib/services/license-control-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    licenseControlService.history(
      actor,
      (await params).id,
      licenseRuntimePage(request.nextUrl.searchParams),
    ),
  );
}
