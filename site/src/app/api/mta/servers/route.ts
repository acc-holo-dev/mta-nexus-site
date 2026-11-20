import type { NextRequest } from "next/server";
import { serversDirectoryApiCopy } from "../../../../features/servers/servers-directory-api-copy";
import { resolveLocale } from "../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../lib/platform/observability";
import { mtaMasterDirectoryService } from "../../../../lib/services/servers/mta-master-directory-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  const copy = serversDirectoryApiCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));

  try {
    const directory = await mtaMasterDirectoryService.getDirectory();
    const playersOnline = directory.servers.reduce(
      (total, server) => total + (server.players ?? 0),
      0,
    );

    return jsonWithRequestId(
      context,
      {
        source: "mta-master",
        fetchedAt: directory.fetchedAt,
        playersOnline,
        servers: directory.servers,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
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
        error: copy.mtaUnavailable,
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
