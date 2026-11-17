import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { resourceCopiesQuery } from "../../../../../features/resources/resource-copy-query";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { resourceCopyService } from "../../../../../lib/services/resources/resource-copy-service";

type Context = { params: Promise<{ id: string }> };
export function GET(request: NextRequest, { params }: Context) {
  return resourceCommerceRequest(request, false, async (actor) => {
    resourceCopiesQuery(request.nextUrl.searchParams);
    return resourceCopyService.preview(actor, (await params).id);
  });
}
export const POST = withBrowserMutation((request: NextRequest, { params }: Context) => {
  return resourceCommerceRequest(request, true, async (actor) => {
    resourceCopiesQuery(request.nextUrl.searchParams);
    return resourceCopyService.create(
      actor,
      (await params).id,
      await readBoundedJson(request, 4096),
    );
  });
});
