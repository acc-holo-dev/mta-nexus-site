import { AppError, ForbiddenError, UnauthorizedError } from "@nexus/domain";
import { resourceModerationCommandSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceControlPageQuery } from "../../../../../lib/resource-release-control-query";
import { resourceModerationService } from "../../../../../lib/services/resource-release-control-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    resourceModerationService.detail(
      actor,
      (await params).id,
      resourceControlPageQuery(request.nextUrl.searchParams),
    ),
  );
}
export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    return resourceCommerceRequest(request, true, async (actor) => {
      if (actor.role !== "admin" && actor.role !== "moderator") throw new ForbiddenError();
      const command = resourceModerationCommandSchema.safeParse(
        await readBoundedJson(request, 16384),
      );
      if (!command.success)
        throw new AppError("Invalid resource moderation", 400, "RESOURCE_MODERATION_INVALID");
      const token = request.cookies.get("nexus_session")?.value;
      if (!token) throw new UnauthorizedError();
      return resourceModerationService.command(actor, (await params).id, command.data, token);
    });
  },
);
