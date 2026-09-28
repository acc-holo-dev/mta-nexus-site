import { NextRequest, NextResponse } from "next/server";
import { productService } from "../../../lib/services/product-service";
import { authService } from "../../../lib/services/auth-service";
import { createProductSchema } from "@nexus/validation";
import { consumeRateLimit } from "@nexus/security";
import { parseMarketQuery } from "../../../lib/market-query";
import { AppError } from "@nexus/domain";

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
  const params = request.nextUrl.searchParams;
  const single = (name: string) => {
    const values = params.getAll(name);
    return values.length === 1 ? values[0] : undefined;
  };
  const { type, sort, query, page } = parseMarketQuery({
    type: single("type"),
    sort: single("sort"),
    q: single("q"),
    page: single("page"),
  });
  const requestedLimit = Number(single("limit") || "50");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
    : 50;
  const { products, hasMore } = await productService.listPublicPage({
    type: type === "all" ? undefined : type,
    sort,
    query,
    page,
    pageSize: limit,
  });

  return NextResponse.json(
    { products, limit, page, hasMore },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return privateJson(
        { error: "Authentication required", code: "UNAUTHORIZED" },
        401,
      );
    }

    const rateLimit = await consumeRateLimit("contentCreation", user.id);
    if (!rateLimit.success) {
      return privateJson(
        {
          error: "Resource creation limit exceeded",
          code: "RATE_LIMIT_EXCEEDED",
        },
        429,
      );
    }

    const parsed = createProductSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return privateJson(
        {
          error: "Invalid resource details",
          code: "PRODUCT_METADATA_INVALID",
          details: parsed.error.format(),
        },
        400,
      );
    }
    if (parsed.data.price !== 0) {
      return privateJson(
        {
          error: "Paid resources are disabled until a payment provider is configured",
          code: "PAID_RESOURCES_DISABLED",
        },
        422,
      );
    }

    const product = await productService.createProduct(
      {
        ...parsed.data,
        authorId: user.id,
        status: "draft",
        currentVersion: "0.1.0",
        isFeatured: false,
        screenshots: [],
      },
      user
    );

    return privateJson({ product }, 201 );
  } catch (error: unknown) {
    const databaseCode =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    if (databaseCode === "23505") {
      return privateJson(
        {
          error: "A resource with this slug already exists",
          code: "PRODUCT_SLUG_EXISTS",
        },
        409,
      );
    }
    if (error instanceof AppError) {
      return privateJson(
        { error: error.message, code: error.code },
        error.statusCode,
      );
    }

    console.error("Resource creation error:", error);
    return privateJson(
      {
        error: "Could not create resource",
        code: "RESOURCE_CREATION_FAILED",
      },
      500,
    );
  }
}
