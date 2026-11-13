import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { resourceMediaService } from "../../../../../../lib/services/resource-media-service";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    resourceMediaService.managed((await context.params).id, actor.id, true),
  );
}
