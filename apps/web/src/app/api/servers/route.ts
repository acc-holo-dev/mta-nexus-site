import type { NextRequest } from "next/server";
import { consumeRateLimit } from "@nexus/security";
import { createServerSchema } from "@nexus/validation";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../lib/observability";
import { getTrustedRequestIp } from "../../../lib/request-client-ip";
import { authService } from "../../../lib/services/auth-service";
import {
  indexMtaObservations,
  matchesMtaEndpoint,
  mtaLiveStatus,
  mtaMasterDirectoryService,
} from "../../../lib/services/mta-master-directory-service";
import { serverService } from "../../../lib/services/server-service";
import { mtaDirectoryHttpCacheControl } from "../../../lib/mta-directory-cache";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

const errorHeaders = {
  "Cache-Control": "no-store",
};

function privateJson(
  context: RequestLogContext,
  body: unknown,
  status = 200,
) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const requestedLimit = Number(
      request.nextUrl.searchParams.get("limit") ||
        "100",
    );
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(
          Math.max(
            Math.floor(requestedLimit),
            1,
          ),
          100,
        )
      : 100;

    // Editorial data and the official directory are independent reads.
    // Directory failure must not take down owner-managed server listings.
    const [servers, directory] = await Promise.all([
      serverService.listServers(limit),
      mtaMasterDirectoryService.getDirectory().catch(() => null),
    ]);
    const directoryIsStale = directory?.isStale ?? false;
    const observations = directory?.servers ?? [];
    // One server benefits from an early Array.find; for many listings,
    // reuse the incremental endpoint index instead of N full-array scans.
    const observationFor = servers.length > 1
      ? indexMtaObservations(observations)
      : (server: { ipAddress: string; port: number }) =>
          observations.find((observation) => matchesMtaEndpoint(server, observation));

    const enrichedServers = servers.map((server) => {
      const liveObservation = observationFor(server);
      return {
        ...server,
        liveObservation: liveObservation ?? null,
        liveStatus: mtaLiveStatus(liveObservation, directoryIsStale),
      };
    });

    return Response.json(
      {
        servers: enrichedServers,
        directoryIsStale,
        limit,
      },
      // Bound shared HTTP caching by the remaining master-list freshness.
      { headers: { "Cache-Control": mtaDirectoryHttpCacheControl(directory) } },
    );
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "servers.list_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(
      context,
      {
        error:
          "Server listings are temporarily unavailable",
      },
      {
        status: 503,
        headers: errorHeaders,
      },
    );
  }
}

export async function POST(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const ip = getTrustedRequestIp(request);
    const rateLimit = await consumeRateLimit(
      "serverMutation",
      ip,
    );
    if (!rateLimit.success) {
      return privateJson(
        context,
        {
          error:
            "Server registration limit exceeded",
        },
        429,
      );
    }

    const token =
      request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return privateJson(
        context,
        { error: "Authentication required" },
        401,
      );
    }

    const parsed = createServerSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return privateJson(
        context,
        {
          error: "Invalid server details",
          details: parsed.error.format(),
        },
        400,
      );
    }

    const server = await serverService.createServer(
      {
        ...parsed.data,
        ownerId: parsed.data.organizationId
          ? undefined
          : user.id,
      },
      user,
    );
    return privateJson(
      context,
      { server },
      201,
    );
  } catch (error: unknown) {
    const appError =
      error instanceof Error &&
      "statusCode" in error
        ? (error as Error & {
            statusCode: number;
          })
        : null;
    logRequestEvent({
      level: "error",
      event: "server.registration_failed",
      context,
      status: appError?.statusCode || 500,
      error,
    });
    return privateJson(
      context,
      {
        error:
          appError?.message ||
          "Could not register server",
      },
      appError?.statusCode || 500,
    );
  }
}
