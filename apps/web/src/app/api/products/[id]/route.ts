import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { editProductDetailsSchema } from "@nexus/validation";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../lib/observability";
import { authService } from "../../../../lib/services/auth-service";
import { productService } from "../../../../lib/services/product-service";

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

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const context = createRequestLogContext(request);

  try {
    const { id } = await params;
    const product =
      await productService.getProductById(id);

    if (!product) {
      return jsonWithRequestId(
        context,
        { error: "Product not found" },
        {
          status: 404,
          headers: errorHeaders,
        },
      );
    }

    return Response.json({
      id: product.id,
      title: product.title,
      slug: product.slug,
      type: product.type,
      price: 0,
      currency: "USD",
      licenseModel: "unlimited",
      currentVersion: product.currentVersion,
      thumbnailUrl: product.thumbnailUrl,
    });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "product.detail_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(
      context,
      {
        error:
          "Resource details are temporarily unavailable",
      },
      {
        status: 503,
        headers: errorHeaders,
      },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const context = createRequestLogContext(request);

  try {
    const actor = await authService.getSession(
      request.cookies.get("nexus_session")?.value,
    );
    if (!actor) {
      return privateJson(
        context,
        { code: "UNAUTHORIZED" },
        401,
      );
    }

    const { id } = await params;
    if (
      !(await productService.getManagedProduct(
        id,
        actor,
      ))
    ) {
      return privateJson(
        context,
        { code: "NOT_FOUND" },
        404,
      );
    }

    const limit = await consumeRateLimit(
      "contentCreation",
      actor.id,
    );
    if (!limit.success) {
      return privateJson(
        context,
        {
          code: "RATE_LIMIT_EXCEEDED",
        },
        429,
      );
    }

    const revision =
      request.headers.get("if-match");
    let expectedUpdatedAt: Date | undefined;
    if (revision !== null) {
      if (
        !/^"d{4}-d{2}-d{2}Td{2}:d{2}:d{2}.d{3}Z"$/u.test(
          revision,
        )
      ) {
        return privateJson(
          context,
          {
            code:
              "PRODUCT_METADATA_INVALID",
          },
          400,
        );
      }

      const timestamp = revision.slice(1, -1);
      expectedUpdatedAt = new Date(timestamp);
      if (
        !Number.isFinite(
          expectedUpdatedAt.getTime(),
        ) ||
        expectedUpdatedAt.toISOString() !==
          timestamp
      ) {
        return privateJson(
          context,
          {
            code:
              "PRODUCT_METADATA_INVALID",
          },
          400,
        );
      }
    }

    const parsed =
      editProductDetailsSchema.safeParse(
        await request.json().catch(() => null),
      );
    if (!parsed.success) {
      return privateJson(
        context,
        {
          code: "PRODUCT_METADATA_INVALID",
        },
        400,
      );
    }

    const product = expectedUpdatedAt
      ? await productService.updateProductDetails(
          id,
          parsed.data,
          actor,
          expectedUpdatedAt,
        )
      : await productService.updateProductDetails(
          id,
          parsed.data,
          actor,
        );

    return privateJson(context, {
      product: {
        id: product.id,
        title: product.title,
        shortDescription:
          product.shortDescription,
        description: product.description,
        tags: product.tags,
        updatedAt: product.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return privateJson(
        context,
        { code: error.code },
        error.statusCode,
      );
    }

    logRequestEvent({
      level: "error",
      event: "product.update_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(
      context,
      {
        code: "RESOURCE_UPDATE_FAILED",
      },
      500,
    );
  }
}
