import type { NextRequest } from "next/server";
import { UnauthorizedError, ValidationError } from "@nexus/domain";
import { licenseOwnerCommandSchema } from "@nexus/validation";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { licenseControlService } from "../../../../../lib/services/license-control-service";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";

export const POST = withBrowserMutation(
  (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    return resourceCommerceRequest(request, true, async (user) => {
      const currentToken = request.cookies.get("nexus_session")?.value;
      if (!currentToken) throw new UnauthorizedError();
      const parsed = licenseOwnerCommandSchema.safeParse(await readBoundedJson(request, 4096));
      if (!parsed.success) throw new ValidationError("Invalid license command");
      return licenseControlService.ownerCommand(
        user,
        (await context.params).id,
        parsed.data,
        currentToken,
      );
    });
  },
);
