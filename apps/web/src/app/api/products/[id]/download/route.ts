import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../../lib/services/auth-service";
import { commerceService } from "../../../../../lib/services/commerce-service";
import { productRepository, buildRepository, auditRepository } from "@nexus/db";
import { generateId } from "@nexus/security";
import { rateLimiter } from "@nexus/security";

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
        { status: 401 }
      );
    }

    // Rate limit downloads per user
    const rl = await rateLimiter.consume(`download:${user.id}`, 30, 60);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many download requests. Please try again later." },
        { status: 429 }
      );
    }

    const product = await productRepository.findById(productId);
    if (!product || product.status !== "published") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Authorization: author, active license holder, or admin
    const isAuthor = product.authorId === user.id;
    const isLicensed = await commerceService.checkEntitlement(
      { type: "user", id: user.id },
      productId,
      "product.download"
    );

    if (!isAuthor && !isLicensed && product.price > 0 && user.role !== "admin") {
      return NextResponse.json(
        { error: "Active license or ownership required to download this resource" },
        { status: 403 }
      );
    }

    // A real, published build MUST exist — no fallbacks
    const builds = await buildRepository.listByProduct(productId);
    const latestBuild = builds.find((b) => b.status === "published");

    if (!latestBuild) {
      return NextResponse.json(
        { error: "No published build is currently available for this product" },
        { status: 404 }
      );
    }

    await auditRepository.record({
      id: generateId("aud"),
      actorId: user.id,
      actorType: "user",
      action: "product.downloaded",
      targetId: productId,
      targetType: "product",
      details: { buildId: latestBuild.id, version: latestBuild.version },
    });

    // Controlled delivery: storage key is resolved server-side only, never exposed as a public URL
    return NextResponse.json({
      success: true,
      build: {
        id: latestBuild.id,
        version: latestBuild.version,
        sha256Hash: latestBuild.sha256Hash,
        fileSizeBytes: latestBuild.fileSizeBytes,
        releaseNotes: latestBuild.releaseNotes,
      },
      deliveryToken: generateId("ses"),
      message: "Build delivery authorized. Use the Nexus downloader with your license key to fetch the archive.",
    });
  } catch (error: any) {
    console.error("Download authorization error:", error.message);
    return NextResponse.json(
      { error: "Failed to authorize download" },
      { status: 500 }
    );
  }
}
