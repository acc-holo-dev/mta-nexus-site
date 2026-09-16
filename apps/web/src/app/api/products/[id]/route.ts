import { NextRequest, NextResponse } from "next/server";
import { productRepository } from "@nexus/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await productRepository.findById(id);

  if (!product || product.status !== "published") {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Public DTO only — no internal metadata
  return NextResponse.json({
    id: product.id,
    title: product.title,
    slug: product.slug,
    type: product.type,
    price: product.price,
    currency: product.currency,
    licenseModel: product.licenseModel,
    currentVersion: product.currentVersion,
    thumbnailUrl: product.thumbnailUrl,
  });
}
