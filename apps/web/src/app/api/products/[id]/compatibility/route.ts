import { AppError } from "@nexus/domain";
import { resourceCompatibilitySchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceManagementService } from "../../../../../lib/services/resource-management-service";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";

export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    return resourceCommerceRequest(request, true, async (actor) => {
      const { id } = await params;
      const parsed = resourceCompatibilitySchema.safeParse(await readBoundedJson(request, 8192));
      if (!parsed.success)
        throw new AppError("Invalid compatibility", 400, "RESOURCE_COMPATIBILITY_INVALID");
      return {
        product: await resourceManagementService.updateCompatibility(id, actor, parsed.data),
      };
    });
  },
);
