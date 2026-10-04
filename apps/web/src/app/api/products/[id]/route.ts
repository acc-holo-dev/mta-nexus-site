import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { editProductDetailsSchema } from "@nexus/validation";
import { authService } from "../../../../lib/services/auth-service";
import { productService } from "../../../../lib/services/product-service";

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

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: privateHeaders });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authService.getSession(request.cookies.get("nexus_session")?.value);
    if (!actor) return privateJson({ code: "UNAUTHORIZED" }, 401);
    const { id } = await params;
    // Reject inaccessible resources before consuming input or editing.
    if (!await productService.getManagedProduct(id, actor)) return privateJson({ code: "NOT_FOUND" }, 404);
    const limit = await consumeRateLimit("contentCreation", actor.id);
    if (!limit.success) return privateJson({ code: "RATE_LIMIT_EXCEEDED" }, 429);
    const parsed = editProductDetailsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return privateJson({ code: "PRODUCT_METADATA_INVALID" }, 400);
    const product = await productService.updateProductDetails(id, parsed.data, actor);
    return privateJson({ product: { id: product.id, title: product.title, shortDescription: product.shortDescription,
      description: product.description, tags: product.tags, updatedAt: product.updatedAt } });
  } catch (error) {
    if (error instanceof AppError) return privateJson({ code: error.code }, error.statusCode);
    console.error("Product details update failed:", error);
    return privateJson({ code: "RESOURCE_UPDATE_FAILED" }, 500);
  }
}
