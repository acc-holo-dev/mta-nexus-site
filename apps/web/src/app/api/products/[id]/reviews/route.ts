import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../../lib/services/auth-service";
import {
  contentRepository,
  productRepository,
  entitlementRepository,
  auditRepository,
} from "@nexus/db";
import { addCommentSchema } from "@nexus/validation";
import { generateId } from "@nexus/security";
import { rateLimiter } from "@nexus/security";

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

    const product = await productRepository.findById(productId);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Review integrity rule 1: no self-reviews
    if (product.authorId === user.id) {
      return NextResponse.json(
        { error: "You cannot review your own product" },
        { status: 403 }
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

    const comment = await contentRepository.addComment({
      id: generateId("cmt"),
      productId,
      authorId: user.id,
      text: parsed.data.text,
      rating,
      isVerifiedPurchase: hasAcquired,
    });

    // Recalculate true rating average from database reviews (source of truth)
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
      details: { rating, verifiedAcquisition: hasAcquired },
    });

    return NextResponse.json(
      { success: true, review: comment, newRating: { ratingAverage, ratingCount } },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Review submission error:", error);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
