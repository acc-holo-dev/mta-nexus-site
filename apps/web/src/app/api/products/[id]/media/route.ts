import { AppError } from "@nexus/domain";
import { resourceMediaCommandSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceMediaUpload } from "../../../../../lib/resource-media-upload-http";
import { resourceMediaService } from "../../../../../lib/services/resource-media-service";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  return resourceCommerceRequest(request, false, async (actor) =>
    resourceMediaService.managed((await context.params).id, actor.id),
  );
}
export const POST = withBrowserMutation(async (request: NextRequest, context: Context) => {
  return resourceMediaUpload(request, (await context.params).id);
});
export const PATCH = withBrowserMutation(async (request: NextRequest, context: Context) => {
  return resourceCommerceRequest(request, true, async (actor) => {
    const parsed = resourceMediaCommandSchema.safeParse(await readBoundedJson(request));
    if (!parsed.success)
      throw new AppError("Invalid gallery command", 400, "RESOURCE_MEDIA_INVALID");
    return resourceMediaService.command((await context.params).id, actor.id, parsed.data);
  });
});
