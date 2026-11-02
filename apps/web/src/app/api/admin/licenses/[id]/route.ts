import { UnauthorizedError, ValidationError } from "@nexus/domain";
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
      const parsed = licenseModerationCommandSchema.safeParse(await readBoundedJson(request, 4096));
      if (!parsed.success) throw new ValidationError("Invalid license moderation command");
      return licenseControlService.moderate(
        user,
        (await context.params).id,
        parsed.data,
        currentToken,
      );
    });
  },
);
