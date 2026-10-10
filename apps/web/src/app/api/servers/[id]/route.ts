import type { NextRequest } from "next/server";
import { consumeRateLimit } from "@nexus/security";
import { updateServerSchema } from "@nexus/validation";
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

function json(
  context: RequestLogContext,
  body: unknown,
  status = 200,
) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

// Share the strict HTTP(S) URL policy with server creation. Ownership,
// organization and slug changes are not permitted through this endpoint.
const serverUpdateSchema = updateServerSchema
  .omit({ slug: true, organizationId: true })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = createRequestLogContext(request);
  try {
    const token =
      request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return json(
        context,
        { error: "Authentication required" },
        401,
      );
    }

    const rateLimit = await consumeRateLimit(
      "serverMutation",
      user.id,
    );
    if (!rateLimit.success) {
      return json(
        context,
        { error: "Server update limit exceeded" },
        429,
      );
    }

    const parsed = serverUpdateSchema.safeParse(
      await request.json().catch(() => null),
    );
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
    const server = await serverService.updateServer(
      id,
      parsed.data,
      user,
    );
    return json(context, { server });
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
      event: "server.update_failed",
      context,
      status: appError?.statusCode || 500,
      error,
    });
    return json(
      context,
      {
        error:
          appError?.message ||
          "Could not update server",
      },
      appError?.statusCode || 500,
    );
  }
}
