import { AppError, ForbiddenError, UnauthorizedError } from "@nexus/domain";
import { resourceModerationCommandSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { resourceControlPageQuery } from "../../../../../features/resources/resource-release-control-query";
import { readBoundedJson } from "../../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../../lib/http/browser-route-adapter";
import { resourceModerationService } from "../../../../../lib/services/resources/resource-release-control-service";
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
