import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../../lib/services/auth-service";
import {
  contentRepository,
  entitlementRepository,
} from "@nexus/db";
import { productService } from "../../../../../lib/services/product-service";
import { addCommentSchema } from "@nexus/validation";
import { generateId, consumeRateLimit } from "@nexus/security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;
  const product = await productService.getProductById(productId);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const reviews = await contentRepository.listComments({ productId });
  return NextResponse.json({ reviews });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return NextResponse.json({ error: "Authentication required to review" }, { status: 401 });
    }

    // Rate limit reviews per user
    const rl = await consumeRateLimit("reviewSubmission", user.id);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many review submissions. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = addCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid review content", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const product = await productService.getProductById(productId);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Review integrity rule 1: current product managers cannot review
    // resources they control. Historical author attribution is not authority.
    if (await productService.canManageProduct(product, user)) {
      return NextResponse.json(
        { error: "You cannot review a product you manage" },
        { status: 403 },
      );
    }

    // Review integrity rule 2: one review per user per product
    const hasExisting = await contentRepository.hasReviewFromUser(productId, user.id);
    if (hasExisting) {
      return NextResponse.json(
        { error: "You have already reviewed this product" },
        { status: 409 }
      );
    }

    // Review integrity rule 3: the reviewer must have acquired the resource
    const hasAcquired = await entitlementRepository.hasEntitlement(
      { type: "user", id: user.id },
      productId,
      "product.download"
    );

    if (!hasAcquired) {
      return NextResponse.json(
        { error: "Add this resource to your library before reviewing it" },
        { status: 403 }
      );
    }

    const rating = Math.min(5, Math.max(1, parsed.data.rating || 5));

    const {
      review: comment,
      ratingCount,
      ratingAverage,
    } = await contentRepository.addProductReview(
      {
        id: generateId("cmt"),
        productId,
        authorId: user.id,
        text: parsed.data.text,
        rating,
        isVerifiedPurchase: hasAcquired,
      },
      {
        id: generateId("aud"),
        actorId: user.id,
        actorType: "user",
        action: "product.review_submitted",
        targetId: productId,
        targetType: "product",
        details: { rating, verifiedAcquisition: hasAcquired },
      },
    );

    return NextResponse.json(
      { success: true, review: comment, newRating: { ratingAverage, ratingCount } },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_PUBLISHED") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const databaseError = error as { code?: unknown };
    if (databaseError.code === "23505") {
      return NextResponse.json(
        { error: "You have already reviewed this product" },
        { status: 409 }
      );
    }

    console.error("Review submission error:", error);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
