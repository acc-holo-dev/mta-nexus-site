import { type NextRequest, NextResponse } from "next/server";
import { createRequestLogContext, logRequestEvent } from "../../../../lib/observability";
import { mtaMasterDirectoryService } from "../../../../lib/services/mta-master-directory-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const directory = await mtaMasterDirectoryService.getDirectory();
    const playersOnline = directory.servers.reduce((total, server) => total + (server.players ?? 0), 0);

    return NextResponse.json({
      source: "mta-master",
      fetchedAt: directory.fetchedAt,
      playersOnline,
      servers: directory.servers,
    });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "mta.directory.fetch_failed",
      context,
      status: 503,
      error,
    });
    return NextResponse.json(
      { error: "MTA server directory is temporarily unavailable" },
      { status: 503 }
    );
  }
}
