import { type NextRequest, NextResponse } from "next/server";
import { createRequestLogContext, logRequestEvent } from "../../../../../lib/observability";
import { authService } from "../../../../../lib/services/auth-service";
import {
  contentRepository,
  entitlementRepository,
} from "@nexus/db";
import { productService } from "../../../../../lib/services/product-service";
import { addCommentSchema } from "@nexus/validation";
import { generateId, consumeRateLimit } from "@nexus/security";

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

export async function GET(
  _request: NextRequest,
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
  const context = createRequestLogContext(request);
  try {
    const { id: productId } = await params;
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return privateJson({ error: "Authentication required to review" }, 401 );
    }

    // Rate limit reviews per user
    const rl = await consumeRateLimit("reviewSubmission", user.id);
    if (!rl.success) {
      return privateJson(
        { error: "Too many review submissions. Please try again later." },
        429 
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = addCommentSchema.safeParse(body);

    if (!parsed.success) {
      return privateJson(
        { error: "Invalid review content", details: parsed.error.format() },
        400 
      );
    }

    const product = await productService.getProductById(productId);
    if (!product) {
      return privateJson({ error: "Product not found" }, 404 );
    }

    // Review integrity rule 1: current product managers cannot review
    // resources they control. Historical author attribution is not authority.
    if (await productService.canManageProduct(product, user)) {
      return privateJson(
        { error: "You cannot review a product you manage" },
        403 ,
      );
    }

    // Review integrity rule 2: one review per user per product
    const hasExisting = await contentRepository.hasReviewFromUser(productId, user.id);
    if (hasExisting) {
      return privateJson(
        { error: "You have already reviewed this product" },
        409 
      );
    }

    // Review integrity rule 3: the reviewer must have acquired the resource
    const hasAcquired = await entitlementRepository.hasEntitlement(
      { type: "user", id: user.id },
      productId,
      "product.download"
    );

    if (!hasAcquired) {
      return privateJson(
        { error: "Add this resource to your library before reviewing it" },
        403 
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

    return privateJson(
      { success: true, review: comment, newRating: { ratingAverage, ratingCount } },
      201 
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_PUBLISHED") {
      return privateJson({ error: "Product not found" }, 404 );
    }

    const databaseError = error as { code?: unknown };
    if (databaseError.code === "23505") {
      return privateJson(
        { error: "You have already reviewed this product" },
        409 
      );
    }

    logRequestEvent({
      level: "error",
      event: "product.review_submit_failed",
      context,
      status: 500,
      error,
    });
    return privateJson({ error: "Failed to submit review" }, 500 );
  }
}
