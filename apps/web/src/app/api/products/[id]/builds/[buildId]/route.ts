import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { z } from "zod";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../../../lib/observability";
import { authService } from "../../../../../../lib/services/auth-service";
import { productService } from "../../../../../../lib/services/product-service";

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

const retireBuildSchema = z
  .object({
    action: z.literal("retire"),
    reason: z
      .string()
      .trim()
      .min(3)
      .max(2_000)
      .optional(),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      buildId: string;
    }>;
  },
) {
  const context = createRequestLogContext(request);
  try {
    const token =
      request.cookies.get("nexus_session")?.value;
    const actor =
      await authService.getSession(token);
    if (!actor) {
      return json(
        context,
        { error: "Authentication required" },
        401,
      );
    }

    const parsed = retireBuildSchema.safeParse(
      await request.json(),
    );
    if (!parsed.success) {
      return json(
        context,
        {
          error:
            "Invalid build lifecycle action",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const { id: productId, buildId } =
      await params;
    const build =
      await productService.retireBuild(
        {
          productId,
          buildId,
          reason: parsed.data.reason,
        },
        actor,
      );
    return json(context, { build });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return json(
        context,
        {
          error: error.message,
          code: error.code,
        },
        error.statusCode,
      );
    }

    logRequestEvent({
      level: "error",
      event:
        "product.build_lifecycle_failed",
      context,
      status: 500,
      error,
    });
    return json(
      context,
      {
        error:
          "Could not update build lifecycle",
      },
      500,
    );
  }
}
