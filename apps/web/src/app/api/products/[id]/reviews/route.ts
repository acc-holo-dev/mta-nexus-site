import type { NextRequest } from "next/server";
import {
  contentRepository,
  entitlementRepository,
} from "@nexus/db";
import {
  consumeRateLimit,
  generateId,
} from "@nexus/security";
import { addCommentSchema } from "@nexus/validation";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../../lib/observability";
import { authService } from "../../../../../lib/services/auth-service";
import { productService } from "../../../../../lib/services/product-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

const errorHeaders = {
  "Cache-Control": "no-store",
};

function privateJson(
  context: RequestLogContext,
  body: unknown,
  status = 200,
) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const context = createRequestLogContext(request);

  try {
    const { id: productId } = await params;
    const product =
      await productService.getProductById(
        productId,
      );

    if (!product) {
      return jsonWithRequestId(
        context,
        { error: "Product not found" },
        {
          status: 404,
          headers: errorHeaders,
        },
      );
    }

    const reviews =
      await contentRepository.listComments({
        productId,
      });
    return Response.json({ reviews });
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "product.reviews_fetch_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(
      context,
      {
        error:
          "Resource reviews are temporarily unavailable",
      },
      {
        status: 503,
        headers: errorHeaders,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const context = createRequestLogContext(request);

  try {
    const { id: productId } = await params;
    const token =
      request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return privateJson(
        context,
        {
          error:
            "Authentication required to review",
        },
        401,
      );
    }

    const rl = await consumeRateLimit(
      "reviewSubmission",
      user.id,
    );
    if (!rl.success) {
      return privateJson(
        context,
        {
          error:
            "Too many review submissions. Please try again later.",
        },
        429,
      );
    }

    const parsed = addCommentSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return privateJson(
        context,
        {
          error: "Invalid review content",
          details: parsed.error.format(),
        },
        400,
      );
    }

    const product =
      await productService.getProductById(
        productId,
      );
    if (!product) {
      return privateJson(
        context,
        { error: "Product not found" },
        404,
      );
    }

    if (
      await productService.canManageProduct(
        product,
        user,
      )
    ) {
      return privateJson(
        context,
        {
          error:
            "You cannot review a product you manage",
        },
        403,
      );
    }

    const hasExisting =
      await contentRepository.hasReviewFromUser(
        productId,
        user.id,
      );
    if (hasExisting) {
      return privateJson(
        context,
        {
          error:
            "You have already reviewed this product",
        },
        409,
      );
    }

    const hasAcquired =
      await entitlementRepository.hasEntitlement(
        { type: "user", id: user.id },
        productId,
        "product.download",
      );
    if (!hasAcquired) {
      return privateJson(
        context,
        {
          error:
            "Add this resource to your library before reviewing it",
        },
        403,
      );
    }

    const rating = Math.min(
      5,
      Math.max(1, parsed.data.rating || 5),
    );

    const {
      review,
      ratingCount,
      ratingAverage,
    } =
      await contentRepository.addProductReview(
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
          action:
            "product.review_submitted",
          targetId: productId,
          targetType: "product",
          details: {
            rating,
            verifiedAcquisition:
              hasAcquired,
          },
        },
      );

    return privateJson(
      context,
      {
        success: true,
        review,
        newRating: {
          ratingAverage,
          ratingCount,
        },
      },
      201,
    );
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "PRODUCT_NOT_PUBLISHED"
    ) {
      return privateJson(
        context,
        { error: "Product not found" },
        404,
      );
    }

    const databaseError =
      error as { code?: unknown };
    if (databaseError.code === "23505") {
      return privateJson(
        context,
        {
          error:
            "You have already reviewed this product",
        },
        409,
      );
    }

    logRequestEvent({
      level: "error",
      event: "product.review_submit_failed",
      context,
      status: 500,
      error,
    });
    return privateJson(
      context,
      {
        error: "Failed to submit review",
      },
      500,
    );
  }
}
