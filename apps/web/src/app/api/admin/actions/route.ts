import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../lib/services/auth-service";
import { productRepository, serverRepository, reportRepository, auditRepository } from "@nexus/db";
import { can, generateId } from "@nexus/security";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user || !can(user, "admin.moderation")) {
      return NextResponse.json({ error: "Forbidden: Admin or moderator privilege required" }, { status: 403 });
    }

    const { targetType, targetId, action, notes } = await request.json();

    if (!targetType || !targetId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (targetType === "product") {
      if (action === "feature") {
        await productRepository.update(targetId, { isFeatured: true });
      } else if (action === "unfeature") {
        await productRepository.update(targetId, { isFeatured: false });
      } else if (action === "suspend") {
        await productRepository.update(targetId, { status: "suspended" });
      } else if (action === "restore") {
        await productRepository.update(targetId, { status: "published" });
      }
    } else if (targetType === "report") {
      if (action === "resolve" || action === "dismiss") {
        await reportRepository.resolve(targetId, action === "resolve" ? "resolved" : "dismissed", notes || "");
      }
    }

    await auditRepository.record({
      id: generateId("aud"),
      actorId: user.id,
      actorType: "admin",
      action: `admin.${action}`,
      targetId,
      targetType,
      details: { notes },
    });

    return NextResponse.json({ success: true, action, targetId });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to execute administrative action" },
      { status: 500 }
    );
  }
}
