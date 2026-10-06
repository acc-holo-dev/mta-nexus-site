import { ValidationError } from "@nexus/domain";
import {
  assertBuildDownloadMetadata,
  BuildArtifactMismatchError,
} from "../../../../../../lib/build-download-metadata";
import path from "node:path";
import { toDownloadWebStream } from "../../../../../../lib/download-web-stream";
import { type NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../../../lib/services/auth-service";
import { auditRepository, buildRepository } from "@nexus/db";
import { storageService } from "@nexus/storage";
import { can, consumeRateLimit, generateId } from "@nexus/security";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function destroyOpenedStream(stream: NodeJS.ReadableStream): void {
  const destroyable = stream as NodeJS.ReadableStream & {
    destroy?: (error?: Error) => void;
  };
  destroyable.destroy?.();
}

function safeReviewerFileName(buildId: string, fileName: string): string {
  const safeBase = path
    .basename(fileName)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 180);
  return `review-${buildId}-${safeBase || "artifact.bin"}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildId: string }> },
) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const actor = await authService.getSession(token);
    if (!actor || !can(actor, "admin.moderation")) {
      return NextResponse.json(
        { error: "Moderator access required" },
        { status: 403, headers: privateHeaders },
      );
    }

    const rateLimit = await consumeRateLimit("download", `moderator:${actor.id}`);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many reviewer downloads" },
        { status: 429, headers: privateHeaders },
      );
    }

    const { buildId } = await params;
    if (!buildId || buildId.length > 128) {
      return NextResponse.json(
        { error: "Build not found" },
        { status: 404, headers: privateHeaders },
      );
    }

    const build = await buildRepository.findById(buildId);
    if (!build) {
      return NextResponse.json(
        { error: "Build not found" },
        { status: 404, headers: privateHeaders },
      );
    }
    if (build.status !== "pending_review") {
      return NextResponse.json(
        { error: "Build is no longer pending review" },
        { status: 409, headers: privateHeaders },
      );
    }
    if (build.scanStatus !== "clean" || !build.scanner?.trim() || !build.scannedAt) {
      return NextResponse.json(
        { error: "Reviewer download requires a provenance-backed clean malware scan" },
        { status: 422, headers: privateHeaders },
      );
    }

    const stored = await storageService.getDownloadStream(build.storageKey, request.signal);
    const contentLength = assertBuildDownloadMetadata(stored, build);
    try {
      request.signal.throwIfAborted();
      await auditRepository.record({
        id: generateId("aud"),
        actorId: actor.id,
        actorType: actor.role === "admin" ? "admin" : "user",
        action: "build.review_artifact_download_started",
        targetId: build.id,
        targetType: "build",
        details: {
          productId: build.productId,
          version: build.version,
        },
      });
      request.signal.throwIfAborted();
    } catch (error) {
      destroyOpenedStream(stored.stream);
      throw error;
    }

    const stream = toDownloadWebStream(stored.stream);
    return new NextResponse(stream, {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeReviewerFileName(
          build.id,
          build.fileName,
        )}"`,
        "Content-Length": String(contentLength),
        "X-Content-SHA256": build.sha256Hash,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    if (request.signal.aborted) {
      return NextResponse.json(
        { error: "Download cancelled", code: "DOWNLOAD_CANCELLED" },
        { status: 499, headers: privateHeaders },
      );
    }
    if (error instanceof BuildArtifactMismatchError) {
      return NextResponse.json(
        {
          error: "Build file does not match its recorded metadata",
          code: "BUILD_ARTIFACT_MISMATCH",
        },
        { status: 409, headers: privateHeaders },
      );
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Resource build file is not available" },
        { status: 404, headers: privateHeaders },
      );
    }
    console.error("Reviewer build download error:", error);
    return NextResponse.json(
      { error: "Could not deliver reviewer artifact" },
      { status: 500, headers: privateHeaders },
    );
  }
}
