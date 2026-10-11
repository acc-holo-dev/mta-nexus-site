import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceCopiesQuery } from "../../../../../lib/resource-copy-query";
import { resourceCopyService } from "../../../../../lib/services/resource-copy-service";

type Context = { params: Promise<{ id: string }> };
export function GET(request: NextRequest, { params }: Context) {
  return resourceCommerceRequest(request, false, async (actor) => {
    resourceCopiesQuery(request.nextUrl.searchParams);
    return resourceCopyService.preview(actor, (await params).id);
  });
}
export function POST(request: NextRequest, { params }: Context) {
  return resourceCommerceRequest(request, true, async (actor) => {
    resourceCopiesQuery(request.nextUrl.searchParams);
    return resourceCopyService.create(
      actor,
      (await params).id,
      await readBoundedJson(request, 4096),
    );
  });
}
