import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { serverContentRate } from "../../../../../../../lib/server-content-api";
import { parseServerWorkspaceHistoryQuery } from "../../../../../../../lib/server-workspace-contract";
import { serverWorkspaceError } from "../../../../../../../lib/server-workspace-copy";
import { serverWorkspaceHistoryService } from "../../../../../../../lib/services/server-workspace-history-service";
import { userPlatformApi } from "../../../../../../../lib/user-platform-api";
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
  if (response.ok)
    response.headers.set("Content-Disposition", 'attachment; filename="server-activity.json"');
  return response;
}
