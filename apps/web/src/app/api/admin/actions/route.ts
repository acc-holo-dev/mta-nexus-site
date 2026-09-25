import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@nexus/domain";
import { z } from "zod";
import { authService } from "../../../../lib/services/auth-service";
import { productService } from "../../../../lib/services/product-service";
import { contentService } from "../../../../lib/services/content-service";
import {
  productRepository,
  reportRepository,
  auditRepository,
  verificationRepository,
} from "@nexus/db";
import { can, consumeRateLimit, generateId } from "@nexus/security";

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
      return NextResponse.json(
        { error: "Forbidden: Admin or moderator privilege required" },
        { status: 403 }
      );
    }

    // Admin actions are rate limited
    const rl = await consumeRateLimit("moderationAction", user.id);
    if (!rl.success) {
      return NextResponse.json({ error: "Too many admin actions" }, { status: 429 });
    }

    const parsed = adminActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid moderation action", details: parsed.error.format() }, { status: 400 });
    }
    const { targetType, targetId, action, notes } = parsed.data;

    if (targetType === "product") {
      const updated = action === "feature"
        ? await productRepository.update(targetId, { isFeatured: true })
        : action === "unfeature"
          ? await productRepository.update(targetId, { isFeatured: false })
          : action === "suspend"
            ? await productRepository.update(targetId, { status: "suspended" })
            : await productRepository.update(targetId, { status: "published" });
      if (!updated) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
    } else if (targetType === "report") {
      if (action === "resolve" || action === "dismiss") {
        const resolved = await reportRepository.resolve(
          targetId,
          action === "resolve" ? "resolved" : "dismissed",
          notes || ""
        );
        if (!resolved) {
          return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }
      }
    } else if (targetType === "verification") {
      // Verification can only be granted through the moderation workflow
      if (action === "approve" || action === "reject") {
        const resolved = await verificationRepository.resolveRequest({
          id: targetId,
          reviewerId: user.id,
          decision: action === "approve" ? "approved" : "rejected",
          reviewNotes: notes,
        });

        if (!resolved) {
          return NextResponse.json(
            { error: "Verification request not found or already resolved" },
            { status: 404 }
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

    if (targetType !== "build") {
      await auditRepository.record({
        id: generateId("aud"),
        actorId: user.id,
        actorType: "admin",
        action: `admin.${action}`,
        targetId,
        targetType,
        details: { notes },
      });
    }

    return NextResponse.json({ success: true, action, targetId });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    console.error("Admin action error:", error);
    return NextResponse.json({ error: "Failed to execute administrative action" }, { status: 500 });
  }
}
