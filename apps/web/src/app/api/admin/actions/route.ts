import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@nexus/domain";
import { z } from "zod";
import { authService } from "../../../../lib/services/auth-service";
import { productService } from "../../../../lib/services/product-service";
import { contentService } from "../../../../lib/services/content-service";
import {
  productRepository,
  reportRepository,
  verificationRepository,
} from "@nexus/db";
import { can, consumeRateLimit, generateId } from "@nexus/security";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: privateHeaders,
  });
}

const adminActionSchema = z.discriminatedUnion("targetType", [
  z.object({ targetType: z.literal("product"), targetId: z.string().min(1), action: z.enum(["feature", "unfeature", "suspend", "restore"]), notes: z.string().max(2000).optional() }),
  z.object({ targetType: z.literal("report"), targetId: z.string().min(1), action: z.enum(["resolve", "dismiss"]), notes: z.string().max(2000).optional() }),
  z.object({ targetType: z.literal("verification"), targetId: z.string().min(1), action: z.enum(["approve", "reject"]), notes: z.string().trim().min(3).max(2000) }),
  z.object({ targetType: z.literal("build"), targetId: z.string().min(1), action: z.enum(["approve", "reject"]), notes: z.string().trim().min(3).max(2000) }),
  z.object({ targetType: z.literal("content"), targetId: z.string().min(1), action: z.enum(["publish", "archive"]), notes: z.string().max(2000).optional() }),
]);

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user || !can(user, "admin.moderation")) {
      return json(
        { error: "Forbidden: Admin or moderator privilege required" },
        403 
      );
    }

    // Admin actions are rate limited
    const rl = await consumeRateLimit("moderationAction", user.id);
    if (!rl.success) {
      return json({ error: "Too many admin actions" }, 429 );
    }

    const parsed = adminActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return json({ error: "Invalid moderation action", details: parsed.error.format() }, 400 );
    }
    const { targetType, targetId, action, notes } = parsed.data;

    const makeAudit = () => ({
      id: generateId("aud"),
      actorId: user.id,
      actorType: "admin" as const,
      action: `admin.${action}`,
      targetId,
      targetType,
      details: { notes },
    });

    if (targetType === "product") {
      if (action === "feature" || action === "unfeature") {
        const updated = await productRepository.updateWithAudit(
          targetId,
          { isFeatured: action === "feature" },
          makeAudit(),
        );
        if (!updated) {
          return json(
            { error: "Product not found" },
            404 ,
          );
        }
      } else if (action === "suspend") {
        const suspended = await productRepository.suspendPublished(
          targetId,
          makeAudit(),
        );
        if (!suspended) {
          const current = await productRepository.findById(targetId);
          if (!current) {
            return json(
              { error: "Product not found" },
              404 ,
            );
          }
          throw new AppError(
            "Only a published resource can be suspended",
            409,
            "PRODUCT_STATE_CHANGED",
          );
        }
      } else {
        const restore = await productRepository.restoreSuspendedWithPublishedBuild(
          targetId,
          makeAudit(),
        );
        if (restore === "not_found") {
          return json(
            { error: "Product not found" },
            404 ,
          );
        }
        if (restore === "no_published_build") {
          throw new AppError(
            "A suspended resource cannot be restored without a published build",
            409,
            "PRODUCT_RESTORE_NO_PUBLISHED_BUILD",
          );
        }
        if (restore === "invalid_state") {
          throw new AppError(
            "Only a suspended resource can be restored",
            409,
            "PRODUCT_STATE_CHANGED",
          );
        }
      }
    } else if (targetType === "report") {
      if (action === "resolve" || action === "dismiss") {
        const resolved = await reportRepository.resolve(
          targetId,
          action === "resolve" ? "resolved" : "dismissed",
          notes || "",
          makeAudit(),
        );
        if (!resolved) {
          const current = await reportRepository.findById(targetId);
          if (!current) {
            return json(
              { error: "Report not found" },
              404 ,
            );
          }
          throw new AppError(
            "Report state changed before moderation completed",
            409,
            "REPORT_STATE_CHANGED",
          );
        }
      }
    } else if (targetType === "verification") {
      // Verification can only be granted through the moderation workflow
      if (action === "approve" || action === "reject") {
        const resolved = await verificationRepository.resolveRequest(
          {
            id: targetId,
            reviewerId: user.id,
            decision: action === "approve" ? "approved" : "rejected",
            reviewNotes: notes,
          },
          makeAudit(),
        );

        if (!resolved) {
          const current = await verificationRepository.findById(targetId);
          if (!current) {
            return json(
              { error: "Verification request not found" },
              404 ,
            );
          }
          throw new AppError(
            "Verification request state changed before moderation completed",
            409,
            "VERIFICATION_STATE_CHANGED",
          );
        }
      }
    } else if (targetType === "build") {
      await productService.reviewBuild({
        buildId: targetId,
        decision: action,
        notes,
      }, user);
    } else if (targetType === "content") {
      await contentService.moderateContent(targetId, action, user, notes);
    }

    return json({ success: true, action, targetId });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return json(
        { error: error.message, code: error.code },
        error.statusCode ,
      );
    }
    console.error("Admin action error:", error);
    return json({ error: "Failed to execute administrative action" }, 500 );
  }
}
