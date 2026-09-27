import { NextRequest, NextResponse } from "next/server";
import { productService } from "../../../lib/services/product-service";
import { authService } from "../../../lib/services/auth-service";
import { createProductSchema } from "@nexus/validation";
import { consumeRateLimit } from "@nexus/security";
import { parseMarketQuery } from "../../../lib/market-query";

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
      return privateJson({ error: "Authentication required" }, 401 );
    }

    const rateLimit = await consumeRateLimit("contentCreation", user.id);
    if (!rateLimit.success) {
      return privateJson({ error: "Resource creation limit exceeded" }, 429 );
    }

    const parsed = createProductSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return privateJson(
        { error: "Invalid resource details", details: parsed.error.format() },
        400 
      );
    }
    if (parsed.data.price !== 0) {
      return privateJson(
        { error: "Paid resources are disabled until a payment provider is configured" },
        422 
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
    const appError =
      error instanceof Error && "statusCode" in error
        ? (error as Error & { statusCode: number })
        : null;
    console.error("Resource creation error:", error);
    return privateJson(
      { error: appError?.message || "Could not create resource" },
      appError?.statusCode || 500 
    );
  }
}
