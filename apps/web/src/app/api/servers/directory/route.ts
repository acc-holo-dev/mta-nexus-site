import type { NextRequest } from "next/server";
import { z } from "zod";
import { mtaMasterDirectoryService } from "../../../../lib/services/mta-master-directory-service";
import { createRequestLogContext, jsonWithRequestId, logRequestEvent } from "../../../../lib/observability";

export const dynamic = "force-dynamic";

const directoryQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  minPlayers: z.coerce.number().int().min(0).max(10_000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  const parsedQuery = directoryQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsedQuery.success) {
    return jsonWithRequestId(context, 
      { error: "Invalid directory query", details: parsedQuery.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const directory = await mtaMasterDirectoryService.getDirectory();
    const { query, minPlayers, limit, offset } = parsedQuery.data;
    const term = query?.toLocaleLowerCase();

    const matchingServers = directory.servers.filter((server) => {
      if ((server.players ?? 0) < minPlayers) return false;
      if (!term) return true;
      return [server.name, server.address, server.gameMode, server.mapName, server.version]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(term);
    });

    return jsonWithRequestId(context, 
      {
        servers: matchingServers.slice(offset, offset + limit),
        total: matchingServers.length,
        offset,
        limit,
        fetchedAt: directory.fetchedAt,
        isStale: directory.isStale,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "directory.fetch_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(context, 
      { error: "The official MTA server directory is temporarily unavailable" },
      { status: 503, headers: { "Retry-After": "30" } }
    );
  }
}
