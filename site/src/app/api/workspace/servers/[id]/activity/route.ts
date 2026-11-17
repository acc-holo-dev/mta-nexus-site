import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../../features/accounts/user-platform-api";
import { serverContentRate } from "../../../../../../features/servers/server-content-api";
import { parseServerWorkspaceHistoryQuery } from "../../../../../../features/servers/server-workspace-contract";
import { serverWorkspaceError } from "../../../../../../features/servers/server-workspace-copy";
import { serverWorkspaceHistoryService } from "../../../../../../lib/services/server-workspace-history-service";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const response = await userPlatformApi(
    request,
    async (actor) => {
      const filters = parseServerWorkspaceHistoryQuery(request.nextUrl.searchParams);
      if (!filters)
        throw new AppError("Invalid history filters", 400, "SERVER_HISTORY_FILTER_INVALID");
      await serverContentRate(actor.id, "search");
      return serverWorkspaceHistoryService.page(actor.id, (await params).id, filters);
    },
    200,
    serverWorkspaceError,
  );

  return response;
}
