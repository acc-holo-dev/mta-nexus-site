import { NextRequest, NextResponse } from "next/server";
import { serverService } from "../../../lib/services/server-service";
import { authService } from "../../../lib/services/auth-service";
import { createServerSchema } from "@nexus/validation";
import { consumeRateLimit } from "@nexus/security";
import { getTrustedRequestIp } from "../../../lib/request-client-ip";
import { matchesMtaEndpoint, mtaLiveStatus, mtaMasterDirectoryService, type MtaMasterServer } from "../../../lib/services/mta-master-directory-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: privateHeaders,
  });
}

export async function GET(request: NextRequest) {
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || "100");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
    : 100;
  const servers = await serverService.listServers(limit);
  let observations: MtaMasterServer[] = [];
  let directoryIsStale = false;

  try {
    const directory = await mtaMasterDirectoryService.getDirectory();
    observations = directory.servers;
    directoryIsStale = directory.isStale;
  } catch {
    // Editorial listings remain available when the official directory is unavailable.
  }

  const enrichedServers = servers.map((server) => {
    const liveObservation = observations.find((observation) =>
      matchesMtaEndpoint(server, observation)
    );

    return {
      ...server,
      liveObservation: liveObservation ?? null,
      liveStatus: mtaLiveStatus(liveObservation, directoryIsStale),
    };
  });

  return NextResponse.json(
    { servers: enrichedServers, directoryIsStale, limit },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const ip = getTrustedRequestIp(request);
    const rateLimit = await consumeRateLimit("serverMutation", ip);
    if (!rateLimit.success) {
      return privateJson({ error: "Server registration limit exceeded" }, 429 );
    }

    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return privateJson({ error: "Authentication required" }, 401 );
    }

    const parsed = createServerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return privateJson(
        { error: "Invalid server details", details: parsed.error.format() },
        400 
      );
    }

    const server = await serverService.createServer(
      {
        ...parsed.data,
        ownerId: parsed.data.organizationId ? undefined : user.id,
      },
      user
    );
    return privateJson({ server }, 201 );
  } catch (error: unknown) {
    const appError =
      error instanceof Error && "statusCode" in error
        ? (error as Error & { statusCode: number })
        : null;
    console.error("Server registration error:", error);
    return privateJson(
      { error: appError?.message || "Could not register server" },
      appError?.statusCode || 500 
    );
  }
}
