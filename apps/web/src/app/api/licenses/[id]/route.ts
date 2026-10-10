import type { NextRequest } from "next/server";
import { NotFoundError } from "@nexus/domain";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { licenseControlService } from "../../../../lib/services/license-control-service";

export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (user) => {
    const { id } = await context.params;
    const license = await licenseControlService.detail(user, id);
    if (!license) throw new NotFoundError("License", id);
    return { license };
  });
}
