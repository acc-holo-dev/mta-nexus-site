import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { libraryReleaseCommandSchema } from "@nexus/validation";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { resourceControlPageQuery } from "../../../../../lib/resource-release-control-query";
import { libraryReleaseService } from "../../../../../lib/services/resource-release-control-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    libraryReleaseService.detail(
      actor,
      (await params).id,
      resourceControlPageQuery(request.nextUrl.searchParams),
    ),
  );
}
export function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, true, async (actor) => {
    if (request.nextUrl.searchParams.size !== 0)
      throw new AppError("Invalid library selection query", 400, "RESOURCE_CONTROL_INVALID");
    const command = libraryReleaseCommandSchema.safeParse(await readBoundedJson(request, 2048));
    if (!command.success)
      throw new AppError("Invalid library selection", 400, "RESOURCE_CONTROL_INVALID");
    return libraryReleaseService.command(actor, (await params).id, command.data);
  });
}
