import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../../lib/services/auth-service";
import { commerceService } from "../../../../../lib/services/commerce-service";
import {
  contentRepository,
  productRepository,
  licenseRepository,
  auditRepository,
} from "@nexus/db";
import { addCommentSchema } from "@nexus/validation";
import { generateId } from "@nexus/security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;
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

    const body = await request.json();
    const parsed = addCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid review content", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const product = await productRepository.findById(productId);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Verify purchase
    const userLicenses = await licenseRepository.listByUser(user.id);
    const hasBought = userLicenses.some((l) => l.productId === productId);

    const rating = Math.min(5, Math.max(1, parsed.data.rating || 5));

    const comment = await contentRepository.addComment({
      id: generateId("cmt"),
      productId,
      authorId: user.id,
      text: parsed.data.text,
      rating,
      isVerifiedPurchase: hasBought,
    });

    // Recalculate true rating average from database reviews
    const allReviews = await contentRepository.listComments({ productId });
    const reviewsWithRating = allReviews.filter((r) => r.rating !== undefined && r.rating !== null);

    const ratingCount = reviewsWithRating.length;
    const ratingSum = reviewsWithRating.reduce((sum, r) => sum + (r.rating || 0), 0);
    const ratingAverage = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) : 0;

    await productRepository.update(productId, {
      ratingCount,
      ratingAverage,
    });

    await auditRepository.record({
      id: generateId("aud"),
      actorId: user.id,
      actorType: "user",
      action: "product.review_submitted",
      targetId: productId,
      targetType: "product",
      details: { rating, isVerifiedPurchase: hasBought },
    });

    return NextResponse.json(
      { success: true, review: comment, newRating: { ratingAverage, ratingCount } },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to submit review" },
      { status: 500 }
    );
  }
}
