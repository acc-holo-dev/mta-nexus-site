import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "@nexus/domain";
import { authService } from "../../../../../../lib/services/auth-service";
import { productService } from "../../../../../../lib/services/product-service";

const retireBuildSchema = z.object({
  action: z.literal("retire"),
  reason: z.string().trim().min(3).max(2_000).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; buildId: string }> }
) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const actor = await authService.getSession(token);
    if (!actor) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const parsed = retireBuildSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid build lifecycle action", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id: productId, buildId } = await params;
    const build = await productService.retireBuild(
      { productId, buildId, reason: parsed.data.reason },
      actor
    );
    return NextResponse.json({ build });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("Build lifecycle error:", error);
    return NextResponse.json({ error: "Could not update build lifecycle" }, { status: 500 });
  }
}
