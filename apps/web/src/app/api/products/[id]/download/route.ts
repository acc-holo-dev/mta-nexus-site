import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../../lib/services/auth-service";
import { commerceService } from "../../../../../lib/services/commerce-service";
import { productRepository, buildRepository, auditRepository } from "@nexus/db";
import { storageService } from "@nexus/storage";
import { generateId } from "@nexus/security";

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

    const product = await productRepository.findById(productId);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check entitlement: author or active license holder
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

    const builds = await buildRepository.listByProduct(productId);
    const latestBuild = builds[0];

    await auditRepository.record({
      id: generateId("aud"),
      actorId: user.id,
      actorType: "user",
      action: "product.downloaded",
      targetId: productId,
      targetType: "product",
      details: { version: latestBuild?.version || product.currentVersion },
    });

    // Provide authorized direct archive payload or signed URL
    return NextResponse.json({
      success: true,
      productId: product.id,
      title: product.title,
      version: latestBuild?.version || product.currentVersion,
      sha256Hash: latestBuild?.sha256Hash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      downloadUrl: `/api/storage/download/${encodeURIComponent(latestBuild?.storageKey || `builds/${product.id}/latest.zip`)}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to authorize download" },
      { status: 500 }
    );
  }
}
