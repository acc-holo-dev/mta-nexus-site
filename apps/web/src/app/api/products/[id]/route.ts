import { NextRequest, NextResponse } from "next/server";
import { productService } from "../../../../lib/services/product-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await productService.getProductById(id);

  if (!product || product.status !== "published") {
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
