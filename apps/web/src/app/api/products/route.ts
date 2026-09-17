import { NextRequest, NextResponse } from "next/server";
import { productService } from "../../../lib/services/product-service";
import { authService } from "../../../lib/services/auth-service";
import { createProductSchema } from "@nexus/validation";
import { consumeRateLimit } from "@nexus/security";

export async function GET() {
  const products = await productService.listProducts({ maxPrice: 0, sort: "popular" });
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rateLimit = await consumeRateLimit("contentCreation", user.id);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Resource creation limit exceeded" }, { status: 429 });
    }

    const parsed = createProductSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid resource details", details: parsed.error.format() },
        { status: 400 }
      );
    }
    if (parsed.data.price !== 0) {
      return NextResponse.json(
        { error: "Paid resources are disabled until a payment provider is configured" },
        { status: 422 }
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

    return NextResponse.json({ product }, { status: 201 });
  } catch (error: unknown) {
    const appError =
      error instanceof Error && "statusCode" in error
        ? (error as Error & { statusCode: number })
        : null;
    console.error("Resource creation error:", error);
    return NextResponse.json(
      { error: appError?.message || "Could not create resource" },
      { status: appError?.statusCode || 500 }
    );
  }
}
