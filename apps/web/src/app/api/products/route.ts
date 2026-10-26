import type { NextRequest } from "next/server";
import type { z } from "zod";
import { AppError, type Product } from "@nexus/domain";
import { createProductSchema } from "@nexus/validation";
import { consumeRateLimit } from "@nexus/security";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../lib/observability";
import { authService } from "../../../lib/services/auth-service";
import { productService } from "../../../lib/services/product-service";
import { parseMarketQuery } from "../../../lib/market-query";
import { isUniqueConstraintViolation } from "../../../lib/postgres-error";
import { withBrowserMutation } from "../../../lib/browser-route-adapter";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

const publicHeaders = {
  "Cache-Control":
    "public, max-age=30, stale-while-revalidate=120",
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

function matchesCreateRequest(
  product: Product,
  input: z.infer<typeof createProductSchema>,
): boolean {
  const sameList = (
    left: readonly string[] = [],
    right: readonly string[] = [],
  ) =>
    left.length === right.length &&
    left.every(
      (value, index) => value === right[index],
    );
  const compatibility = product.compatibility ?? {};
  const requestedCompatibility =
    input.compatibility ?? {};

  return (
    product.title === input.title &&
    product.slug === input.slug &&
    product.description === input.description &&
    (product.shortDescription ?? undefined) ===
      input.shortDescription &&
    product.type === input.type &&
    (product.organizationId ?? undefined) ===
      input.organizationId &&
    sameList(product.tags, input.tags) &&
    compatibility.mtaMinVersion ===
      requestedCompatibility.mtaMinVersion &&
    sameList(
      compatibility.dependencies,
      requestedCompatibility.dependencies,
    )
  );
}

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const params = request.nextUrl.searchParams;
    const single = (name: string) => {
      const values = params.getAll(name);
      return values.length === 1
        ? values[0]
        : undefined;
    };
    const { type, sort, query, page } =
      parseMarketQuery({
        type: single("type"),
        sort: single("sort"),
        q: single("q"),
        page: single("page"),
      });
    const requestedLimit = Number(
      single("limit") || "50",
    );
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(
          Math.max(
            Math.floor(requestedLimit),
            1,
          ),
          100,
        )
      : 50;

    const { products, hasMore } =
      await productService.listPublicPage({
        type:
          type === "all" ? undefined : type,
        sort,
        query,
        page,
        pageSize: limit,
      });

    return Response.json(
      {
        products,
        limit,
        page,
        hasMore,
      },
      { headers: publicHeaders },
    );
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "product.catalog_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(
      context,
      {
        error:
          "Resource catalog is temporarily unavailable",
      },
      {
        status: 503,
        headers: errorHeaders,
      },
    );
  }
}

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);

  try {
    const token =
      request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return privateJson(
        context,
        {
          error: "Authentication required",
          code: "UNAUTHORIZED",
        },
        401,
      );
    }

    const rateLimit = await consumeRateLimit(
      "contentCreation",
      user.id,
    );
    if (!rateLimit.success) {
      return privateJson(
        context,
        {
          error:
            "Resource creation limit exceeded",
          code: "RATE_LIMIT_EXCEEDED",
        },
        429,
      );
    }

    const parsed = createProductSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return privateJson(
        context,
        {
          error:
            "Invalid resource details",
          code: "PRODUCT_METADATA_INVALID",
          details: parsed.error.format(),
        },
        400,
      );
    }

    if (parsed.data.price !== 0) {
      return privateJson(
        context,
        {
          error:
            "Paid resources are disabled until a payment provider is configured",
          code: "PAID_RESOURCES_DISABLED",
        },
        422,
      );
    }

    let product: Product;
    try {
      product = await productService.createProduct(
        {
          ...parsed.data,
          authorId: user.id,
          status: "draft",
          currentVersion: "0.1.0",
          isFeatured: false,
          screenshots: [],
        },
        user,
      );
    } catch (error: unknown) {
      const isDuplicate =
        isUniqueConstraintViolation(error, [
          "products_slug_unique",
          "products_slug_idx",
        ]);

      if (isDuplicate) {
        const existingDraft =
          await productService.getProductPreviewBySlug(
            parsed.data.slug,
            user,
          );
        if (
          existingDraft?.authorId === user.id &&
          existingDraft.status === "draft" &&
          matchesCreateRequest(
            existingDraft,
            parsed.data,
          )
        ) {
          return privateJson(
            context,
            {
              product: existingDraft,
              reusedDraft: true,
            },
            200,
          );
        }
      }

      throw error;
    }

    return privateJson(
      context,
      { product },
      201,
    );
  } catch (error: unknown) {
    if (
      isUniqueConstraintViolation(error, [
        "products_slug_unique",
        "products_slug_idx",
      ])
    ) {
      return privateJson(
        context,
        {
          error:
            "A resource with this slug already exists",
          code: "PRODUCT_SLUG_EXISTS",
        },
        409,
      );
    }

    if (error instanceof AppError) {
      return privateJson(
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
      event: "product.create_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(
      context,
      {
        error: "Could not create resource",
        code: "RESOURCE_CREATION_FAILED",
      },
      500,
    );
  }
});
