import type { NextRequest } from "next/server";
import { z } from "zod";
import { mtaMasterDirectoryService } from "../../../../lib/services/mta-master-directory-service";
import { selectMtaDirectoryPage } from "../../../../lib/mta-directory-page";
import { mtaDirectoryHttpCacheControl } from "../../../../lib/mta-directory-cache";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../lib/observability";

export const dynamic = "force-dynamic";

const directoryQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  minPlayers: z.coerce
    .number()
    .int()
    .min(0)
    .max(10_000)
    .default(0),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .max(10_000)
    .default(0),
});

const errorHeaders = {
  "Cache-Control": "no-store",
};

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  const parsedQuery =
    directoryQuerySchema.safeParse(
      Object.fromEntries(
        request.nextUrl.searchParams,
      ),
    );

  if (!parsedQuery.success) {
    return jsonWithRequestId(
      context,
      {
        error: "Invalid directory query",
        details:
          parsedQuery.error.flatten(),
      },
      {
        status: 400,
        headers: errorHeaders,
      },
    );
  }

  try {
    const directory =
      await mtaMasterDirectoryService.getDirectory();
    const {
      query,
      minPlayers,
      limit,
      offset,
    } = parsedQuery.data;
    const page = selectMtaDirectoryPage(directory.servers, {
      query, minPlayers, limit, offset,
    });

    // Unique request IDs are intentionally omitted from cacheable public
    // representations because intermediaries may replay response headers.
    return Response.json(
      {
        servers: page.servers,
        total: page.total,
        offset,
        limit,
        fetchedAt: directory.fetchedAt,
        isStale: directory.isStale,
      },
      {
        headers: {
          "Cache-Control": mtaDirectoryHttpCacheControl(directory),
        },
      },
    );
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "directory.fetch_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(
      context,
      {
        error:
          "The official MTA server directory is temporarily unavailable",
      },
      {
        status: 503,
        headers: {
          ...errorHeaders,
          "Retry-After": "30",
        },
      },
    );
  }
}
