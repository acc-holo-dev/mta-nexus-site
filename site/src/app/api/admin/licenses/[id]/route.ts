import { AppError, UnauthorizedError, ValidationError } from "@nexus/domain";
import { licenseModerationCommandSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { licenseControlService } from "../../../../../lib/services/license-control-service";

export const POST = withBrowserMutation(
  (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    return resourceCommerceRequest(request, true, async (user) => {
      const currentToken = request.cookies.get("nexus_session")?.value;
      if (!currentToken) throw new UnauthorizedError();
      const expected = request.headers.get("x-nexus-actor-id");
      if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
      if (expected !== user.id) throw new AppError("Account changed", 409, "ACTOR_CHANGED");
      const parsed = licenseModerationCommandSchema.safeParse(await readBoundedJson(request, 4096));
      if (!parsed.success) throw new ValidationError("Invalid license moderation command");
      return {
        ...(await licenseControlService.moderate(
          user,
          (
            await context.params
          ).id,
          parsed.data,
          currentToken,
        )),
        actorId: user.id,
      };
    });
  },
);
