import type { NextRequest } from "next/server";
import { mtaMasterDirectoryService } from "../../../../lib/services/mta-master-directory-service";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../lib/observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const directory =
      await mtaMasterDirectoryService.getDirectory();
    const playersOnline = directory.servers.reduce(
      (total, server) =>
        total + (server.players ?? 0),
      0,
    );

    return jsonWithRequestId(context, {
      source: "mta-master",
      fetchedAt: directory.fetchedAt,
      playersOnline,
      servers: directory.servers,
    }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "mta.directory.fetch_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(
      context,
      {
        error:
          "MTA server directory is temporarily unavailable",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "30",
        },
      },
    );
  }
}
