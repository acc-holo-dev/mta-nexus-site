import type { NextRequest } from "next/server";
import { ValidationError } from "@nexus/domain";
import { licenseOwnerCommandSchema } from "@nexus/validation";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { licenseControlService } from "../../../../../lib/services/license-control-service";

export function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, true, async (user) => {
    const parsed = licenseOwnerCommandSchema.safeParse(await readBoundedJson(request, 4096));
    if (!parsed.success) throw new ValidationError("Invalid license command");
    return licenseControlService.ownerCommand(user, (await context.params).id, parsed.data);
  });
}
