import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../lib/services/auth-service";
import { socialRepository, notificationRepository } from "@nexus/db";
import { generateId } from "@nexus/security";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return NextResponse.json({ following: false });
  }

  const targetType = request.nextUrl.searchParams.get("targetType") || "";
  const targetId = request.nextUrl.searchParams.get("targetId") || "";

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
    if (!targetType || !targetId) {
      return NextResponse.json({ error: "Target type and ID required" }, { status: 400 });
    }

    const follow = await socialRepository.follow({
      id: generateId("fol"),
      followerId: user.id,
      targetType,
      targetId,
    });

    // Notify target user if target is a user/developer
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to follow" },
      { status: 500 }
    );
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
    await socialRepository.unfollow(user.id, targetType, targetId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to unfollow" },
      { status: 500 }
    );
  }
}
