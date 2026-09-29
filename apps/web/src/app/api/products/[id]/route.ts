import { NextRequest, NextResponse } from "next/server";
import { productService } from "../../../../lib/services/product-service";
import { authService } from "../../../../lib/services/auth-service";
import { updateProductSchema } from "@nexus/validation";
import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";

const updateResourceDetailsSchema = updateProductSchema
  .omit({ price: true, currency: true, licenseModel: true, organizationId: true })
  .strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await productService.getProductById(id);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({
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
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authService.getSession(request.cookies.get("nexus_session")?.value);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rateLimit = await consumeRateLimit("resourceMutation", user.id);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Resource update limit exceeded" }, { status: 429 });
    }

    const parsed = updateResourceDetailsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json(
        { error: "Invalid resource update", details: parsed.success ? undefined : parsed.error.format() },
        { status: 400 }
      );
    }

    const { id } = await params;
    const product = await productService.updateProductDetails(id, parsed.data, user);
    return NextResponse.json({ product });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("Resource update error:", error);
    return NextResponse.json({ error: "Could not update resource" }, { status: 500 });
  }
}
