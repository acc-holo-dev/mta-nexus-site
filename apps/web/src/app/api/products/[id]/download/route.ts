import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../../lib/services/auth-service";
import { commerceService } from "../../../../../lib/services/commerce-service";
import { productRepository, buildRepository, auditRepository } from "@nexus/db";
import { storageService } from "@nexus/storage";
import { consumeRateLimit, generateId } from "@nexus/security";

const DOWNLOAD_EXTENSIONS = new Set([".zip", ".rar", ".7z", ".lua"]);
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

function getDownloadExtension(storageKey: string): string {
  const extension = path.extname(storageKey).toLowerCase();
  return DOWNLOAD_EXTENSIONS.has(extension) ? extension : ".zip";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to download resource builds" },
        { status: 401, headers: privateHeaders }
      );
    }

    const rateLimit = await consumeRateLimit("download", user.id);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Too many download requests" }, { status: 429, headers: privateHeaders });
    }

    const product = await productRepository.findById(productId);
    if (!product || product.status !== "published") {
      return NextResponse.json({ error: "Resource not found" }, { status: 404, headers: privateHeaders });
    }

    const hasAccess =
      product.authorId === user.id ||
      user.role === "admin" ||
      (await commerceService.checkEntitlement(
        { type: "user", id: user.id },
        productId,
        "product.download"
      ));
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Add this resource to your library before downloading it" },
        { status: 403, headers: privateHeaders }
      );
    }

    const builds = await buildRepository.listByProduct(productId);
    const latestBuild = builds.find((build) => build.status === "published");
    if (!latestBuild) {
      return NextResponse.json({ error: "No published build is available" }, { status: 404, headers: privateHeaders });
    }

    const stored = await storageService.getDownloadStream(latestBuild.storageKey);
    await auditRepository.record({
      id: generateId("aud"),
      actorId: user.id,
      actorType: "user",
      action: "product.downloaded",
      targetId: productId,
      targetType: "product",
      details: { buildId: latestBuild.id, version: latestBuild.version },
    });

    const stream = Readable.toWeb(stored.stream as Readable) as ReadableStream;
    const fileName = `${product.slug}-${latestBuild.version}${getDownloadExtension(latestBuild.fileName)}`;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": latestBuild.mimeType || stored.meta?.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(stored.meta?.sizeBytes || latestBuild.fileSizeBytes),
        "X-Content-SHA256": latestBuild.sha256Hash,
        ...privateHeaders,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Failed to deliver resource build" }, { status: 500, headers: privateHeaders });
  }
}
