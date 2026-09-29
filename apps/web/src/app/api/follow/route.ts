import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../lib/services/auth-service";
import {
  socialRepository,
  userRepository,
  serverRepository,
  productRepository,
  organizationRepository,
  notificationRepository,
} from "@nexus/db";
import { consumeRateLimit, generateId } from "@nexus/security";

const ALLOWED_TARGET_TYPES = ["user", "server", "product", "organization"] as const;
type TargetType = (typeof ALLOWED_TARGET_TYPES)[number];

function isTargetType(value: unknown): value is TargetType {
  return typeof value === "string" && ALLOWED_TARGET_TYPES.includes(value as TargetType);
}

async function targetExists(targetType: TargetType, targetId: string): Promise<boolean> {
  switch (targetType) {
    case "user":
      return (await userRepository.findById(targetId)) !== null;
    case "server":
      const server = await serverRepository.findById(targetId);
      return server !== null && server.visibility !== "private" && server.status === "active";
    case "product": {
      const product = await productRepository.findById(targetId);
      return product !== null && product.status === "published" && product.price === 0;
    }
    case "organization":
      return (await organizationRepository.findById(targetId)) !== null;
    default:
      return false;
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return NextResponse.json({ following: false });
  }

  const targetType = request.nextUrl.searchParams.get("targetType") || "";
  const targetId = request.nextUrl.searchParams.get("targetId") || "";

  if (!ALLOWED_TARGET_TYPES.includes(targetType as TargetType)) {
    return NextResponse.json({ error: "Invalid target type" }, { status: 400 });
  }

  const following = await socialRepository.isFollowing(user.id, targetType, targetId);
  return NextResponse.json({ following });
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rateLimit = await consumeRateLimit("follow", user.id);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Too many follow requests. Please try again shortly." }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }
    const { targetType, targetId } = body as {
      targetType?: unknown;
      targetId?: unknown;
    };

    if (!isTargetType(targetType)) {
      return NextResponse.json(
        { error: `Invalid target type. Allowed: ${ALLOWED_TARGET_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!targetId || typeof targetId !== "string") {
      return NextResponse.json({ error: "Target ID required" }, { status: 400 });
    }

    if (!(await targetExists(targetType, targetId))) {
      return NextResponse.json({ error: "Target does not exist" }, { status: 404 });
    }

    if (targetType === "user" && targetId === user.id) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    const follow = await socialRepository.follow({
      id: generateId("fol"),
      followerId: user.id,
      targetType,
      targetId,
    });
    if (!follow) {
      return NextResponse.json({ error: "Already following this target" }, { status: 409 });
    }

    if (targetType === "user" && targetId !== user.id) {
      await notificationRepository.create({
        id: generateId("not"),
        recipientId: targetId,
        title: "New Follower",
        message: `@${user.username} started following your activity.`,
        type: "system",
        category: "follow",
        link: `/users/${user.username}`,
      });
    }

    return NextResponse.json({ success: true, follow });
  } catch (error: unknown) {
    console.error("Follow API error:", error);
    return NextResponse.json({ error: "Follow request failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rateLimit = await consumeRateLimit("follow", user.id);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Too many follow requests. Please try again shortly." }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }
    const { targetType, targetId } = body as {
      targetType?: unknown;
      targetId?: unknown;
    };

    if (!isTargetType(targetType)) {
      return NextResponse.json({ error: "Invalid target type" }, { status: 400 });
    }
    if (typeof targetId !== "string" || targetId.length === 0) {
      return NextResponse.json({ error: "Target ID required" }, { status: 400 });
    }

    await socialRepository.unfollow(user.id, targetType, targetId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Follow API error:", error);
    return NextResponse.json({ error: "Follow request failed" }, { status: 500 });
  }
}
