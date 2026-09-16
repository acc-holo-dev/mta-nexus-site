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
import { generateId } from "@nexus/security";

const ALLOWED_TARGET_TYPES = ["user", "server", "product", "organization"] as const;
type TargetType = (typeof ALLOWED_TARGET_TYPES)[number];

async function targetExists(targetType: TargetType, targetId: string): Promise<boolean> {
  switch (targetType) {
    case "user":
      return (await userRepository.findById(targetId)) !== null;
    case "server":
      return (await serverRepository.findById(targetId)) !== null;
    case "product":
      return (await productRepository.findById(targetId)) !== null;
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

    const { targetType, targetId } = await request.json();

    if (!ALLOWED_TARGET_TYPES.includes(targetType)) {
      return NextResponse.json(
        { error: `Invalid target type. Allowed: ${ALLOWED_TARGET_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!targetId || typeof targetId !== "string") {
      return NextResponse.json({ error: "Target ID required" }, { status: 400 });
    }

    // Target must actually exist — no arbitrary references
    if (!(await targetExists(targetType as TargetType, targetId))) {
      return NextResponse.json({ error: "Target does not exist" }, { status: 404 });
    }

    if (targetType === "user" && targetId === user.id) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    const alreadyFollowing = await socialRepository.isFollowing(user.id, targetType, targetId);
    if (alreadyFollowing) {
      return NextResponse.json({ error: "Already following this target" }, { status: 409 });
    }

    const follow = await socialRepository.follow({
      id: generateId("fol"),
      followerId: user.id,
      targetType,
      targetId,
    });

    // Notify target user if following a user/developer
    if (targetType === "user" && targetId !== user.id) {
      await notificationRepository.create({
        id: generateId("not"),
        recipientId: targetId,
        title: "New Follower",
        message: `@${user.username} started following your activity.`,
        type: "system",
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

    const { targetType, targetId } = await request.json();

    if (!ALLOWED_TARGET_TYPES.includes(targetType)) {
      return NextResponse.json({ error: "Invalid target type" }, { status: 400 });
    }

    await socialRepository.unfollow(user.id, targetType, targetId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Follow API error:", error);
    return NextResponse.json({ error: "Follow request failed" }, { status: 500 });
  }
}
