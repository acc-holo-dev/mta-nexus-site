import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { updateServerSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../lib/observability";
import { authService } from "../../../../lib/services/auth-service";
import { serverService } from "../../../../lib/services/server-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(context: RequestLogContext, body: unknown, status = 200) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

// Share the strict HTTP(S) URL policy with server creation. Ownership,
// organization and slug changes are not permitted through this endpoint.
const serverUpdateSchema = updateServerSchema
  .omit({ slug: true, organizationId: true })
  .extend({ expectedUpdatedAt: z.string().datetime({ offset: true }).optional() })
  .strict()
  .refine(
    (value) => Object.keys(value).some((field) => field !== "expectedUpdatedAt"),
    "At least one editable field is required",
  );

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = createRequestLogContext(request);
  try {
    const user = await authService.getSession(request.cookies.get("nexus_session")?.value);
    if (!user) return json(context, { code: "UNAUTHORIZED" }, 401);
    if (!(await consumeRateLimit("resourceInspection", user.id)).success)
      return json(context, { code: "RATE_LIMIT_EXCEEDED" }, 429);
    const { id } = await params;
    const server = await serverService.getManagedServerDetails(id, user);
    if (!server) return json(context, { code: "NOT_FOUND" }, 404);
    return json(context, {
      actorId: user.id,
      server: {
        id: server.id,
        updatedAt: new Date(server.updatedAt).toISOString(),
        name: server.name,
        description: server.description ?? "",
        websiteUrl: server.websiteUrl ?? "",
        discordUrl: server.discordUrl ?? "",
        rulesUrl: server.rulesUrl ?? "",
        mediaUrls: server.mediaUrls ?? [],
        language: server.language ?? "",
        region: server.region ?? "",
        gameplayTags: server.gameplayTags ?? [],
        ipAddress: server.ipAddress,
        port: server.port,
        httpPort: server.httpPort ?? 22005,
        gameMode: server.gameMode ?? "",
        mapName: server.mapName ?? "",
        maxPlayers: server.maxPlayers ?? 128,
        visibility: server.visibility,
      },
    });
  } catch (error: unknown) {
    const appError = error instanceof AppError ? error : null;
    logRequestEvent({
      level: "error",
      event: "server.details_check_failed",
      context,
      status: appError?.statusCode ?? 500,
      error,
    });
    return json(context, { code: appError?.code ?? "INTERNAL_ERROR" }, appError?.statusCode ?? 500);
  }
}

export const PATCH = withBrowserMutation(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const context = createRequestLogContext(request);
    try {
      const token = request.cookies.get("nexus_session")?.value;
      const user = await authService.getSession(token);
      if (!user) {
        return json(context, { error: "Authentication required" }, 401);
      }

      const expectedActor = request.headers.get("x-nexus-actor-id");
      if (expectedActor && expectedActor !== user.id)
        return json(context, { code: "ACTOR_CHANGED" }, 409);

      const rateLimit = await consumeRateLimit("serverMutation", user.id);
      if (!rateLimit.success) {
        return json(context, { error: "Server update limit exceeded" }, 429);
      }

      requireServerJsonContentType(request);
      const parsed = serverUpdateSchema.safeParse(await readBoundedJson(request));
      if (!parsed.success) {
        return json(
          context,
          {
            error: "Invalid server details",
            details: parsed.error.format(),
          },
          400,
        );
      }

      const { id } = await params;
      const { expectedUpdatedAt, ...updates } = parsed.data;
      const server = expectedUpdatedAt
        ? await serverService.updateServer(id, updates, user, new Date(expectedUpdatedAt))
        : await serverService.updateServer(id, updates, user);
      return json(context, { server });
    } catch (error: unknown) {
      const appError = error instanceof AppError ? error : null;
      logRequestEvent({
        level: "error",
        event: "server.update_failed",
        context,
        status: appError?.statusCode || 500,
        error,
      });
      return json(
        context,
        {
          error: appError?.message || "Could not update server",
          ...(appError ? { code: appError.code } : {}),
        },
        appError?.statusCode || 500,
      );
    }
  },
);
