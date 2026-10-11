import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import {
  organizationApi,
  organizationId,
  organizationInput,
} from "../../../../../../../lib/organization-workspace-api";
import { organizationWorkspaceService } from "../../../../../../../lib/services/organization-workspace-service";

type Context = { params: Promise<{ id: string }> };
export function POST(request: NextRequest, { params }: Context) {
  return organizationApi(request, async (user) => {
    if (request.nextUrl.searchParams.size)
      throw new AppError("Unexpected filters", 400, "VALIDATION_ERROR");
    return organizationWorkspaceService.batchMembers(
      organizationId((await params).id),
      await organizationInput(request, user),
      user,
    );
  });
}
