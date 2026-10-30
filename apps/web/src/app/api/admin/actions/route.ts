import { productRepository, reportRepository, verificationRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { can, consumeRateLimit, generateId } from "@nexus/security";
import { resourceModerationCommandSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import { createRequestLogContext, logRequestEvent } from "../../../../lib/observability";
import { authService } from "../../../../lib/services/auth-service";
import { contentService } from "../../../../lib/services/content-service";
import { productService } from "../../../../lib/services/product-service";
import { resourceModerationService } from "../../../../lib/services/resource-release-control-service";

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
  z.object({
    targetType: z.literal("product"),
    targetId: z.string().min(1),
    action: z.enum(["feature", "unfeature", "suspend", "restore"]),
    notes: z.string().max(2000).optional(),
    expectedUpdatedAt: z.string().max(40).optional(),
  }),
  z.object({
    targetType: z.literal("report"),
    targetId: z.string().min(1),
    action: z.enum(["resolve", "dismiss"]),
    notes: z.string().trim().min(3).max(2000),
  }),
  z.object({
    targetType: z.literal("verification"),
    targetId: z.string().min(1),
    action: z.enum(["approve", "reject"]),
    notes: z.string().trim().min(3).max(2000),
  }),
  z.object({
    targetType: z.literal("build"),
    targetId: z.string().min(1),
    action: z.enum(["approve", "reject", "quarantine", "restore"]),
    notes: z.string().trim().min(3).max(2000),
    expectedRevision: z.number().int().min(1).max(2147483646).optional(),
    /** SEC-002: enqueue durable notices for users with a served download receipt. */
    notifyAffectedDownloaders: z.boolean().optional(),
  }),
  z
    .object({
      targetType: z.literal("content"),
      targetId: z.string().min(1).max(128),
      action: z.enum(["publish", "archive"]),
      notes: z.string().trim().min(3).max(2000),
      expectedUpdatedAt: z.iso.datetime(),
    })
    .strict(),
]);

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user || !can(user, "admin.moderation")) {
      return json({ error: "Forbidden: Admin or moderator privilege required" }, 403);
    }

    requireServerJsonContentType(request);
    if (request.headers.get("sec-fetch-site") === "cross-site")
      throw new AppError("Cross-site mutation is forbidden", 403, "FORBIDDEN");

    // Admin actions are rate limited
    const rl = await consumeRateLimit("moderationAction", user.id);
    if (!rl.success) {
      return json({ error: "Too many admin actions" }, 429);
    }

    const parsed = adminActionSchema.safeParse(await readBoundedJson(request, 32768));
    if (!parsed.success) {
      return json({ error: "Invalid moderation action", details: parsed.error.format() }, 400);
    }
    if (
      parsed.data.targetType === "build" &&
      (parsed.data.action === "approve" || parsed.data.action === "reject") &&
      parsed.data.expectedRevision === undefined
    )
      throw new AppError("Observed build revision is required", 400, "BUILD_REVISION_REQUIRED");
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
        if (!token) return json({ error: "Authentication required" }, 401);
        const updated = await productRepository.updateWithAudit(
          targetId,
          { isFeatured: action === "feature" },
          makeAudit(),
          token,
        );
        if (!updated) {
          return json({ error: "Product not found" }, 404);
        }
      } else {
        const command = resourceModerationCommandSchema.safeParse({
          action: action === "suspend" ? "suspend" : "release",
          expectedUpdatedAt: parsed.data.expectedUpdatedAt,
          reason: notes,
        });
        if (!command.success)
          throw new AppError(
            "A current resource revision and moderation reason are required",
            400,
            "RESOURCE_MODERATION_INVALID",
          );
        if (!token) return json({ error: "Authentication required" }, 401);
        await resourceModerationService.command(user, targetId, command.data, token);
      }
    } else if (targetType === "report") {
      if (action === "resolve" || action === "dismiss") {
        if (!token) return json({ error: "Authentication required" }, 401);
        const resolved = await reportRepository.resolve(
          targetId,
          action === "resolve" ? "resolved" : "dismissed",
          notes,
          makeAudit(),
          token,
        );
        if (!resolved) {
          const current = await reportRepository.findById(targetId);
          if (!current) {
            return json({ error: "Report not found" }, 404);
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
        if (!token) return json({ error: "Authentication required" }, 401);
        const resolved = await verificationRepository.resolveRequest(
          {
            id: targetId,
            reviewerId: user.id,
            decision: action === "approve" ? "approved" : "rejected",
            reviewNotes: notes,
            currentToken: token,
          },
          makeAudit(),
        );

        if (!resolved) {
          const current = await verificationRepository.findById(targetId);
          if (!current) {
            return json({ error: "Verification request not found" }, 404);
          }
          throw new AppError(
            "Verification request state changed before moderation completed",
            409,
            "VERIFICATION_STATE_CHANGED",
          );
        }
      }
    } else if (targetType === "build") {
      if (!token) return json({ error: "Authentication required" }, 401);
      if (action === "approve" || action === "reject") {
        await productService.reviewBuild(
          {
            buildId: targetId,
            decision: action,
            notes,
            expectedRevision: parsed.data.expectedRevision as number,
          },
          user,
          token,
        );
      } else if (action === "quarantine") {
        await productService.quarantineBuild(
          {
            buildId: targetId,
            reason: notes,
            notifyAffectedDownloaders: parsed.data.notifyAffectedDownloaders === true,
          },
          user,
          token,
        );
      } else {
        await productService.restoreQuarantinedBuild(
          {
            buildId: targetId,
            reason: notes,
          },
          user,
          token,
        );
      }
    } else if (targetType === "content") {
      if (!token) return json({ error: "Authentication required" }, 401);
      // Server-follower fanout enqueues in the moderation transaction; no after().
      await contentService.moderateContent(
        targetId,
        action,
        user,
        token,
        notes,
        new Date(parsed.data.expectedUpdatedAt),
      );
    }

    return json({ success: true, action, targetId });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    logRequestEvent({
      level: "error",
      event: "admin.action_failed",
      context,
      status: 500,
      error,
    });
    return json({ error: "Failed to execute administrative action" }, 500);
  }
});
