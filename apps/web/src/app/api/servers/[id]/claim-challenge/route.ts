import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { authService } from "../../../../../lib/services/auth-service";
import { serverClaimService } from "../../../../../lib/services/server-claim-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: privateHeaders },
      );
    }

    const rateLimit = await consumeRateLimit(
      "serverClaimProof",
      user.id,
    );
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many server control proof attempts" },
        { status: 429, headers: privateHeaders },
      );
    }

    const { id: serverId } = await params;
    if (!serverId || serverId.length > 128) {
      return NextResponse.json(
        { error: "Server not found" },
        { status: 404, headers: privateHeaders },
      );
    }

    const challenge = await serverClaimService.issueChallenge(
      serverId,
      user,
    );

    return NextResponse.json(
      {
        challenge,
        instruction:
          "Temporarily add the exact token to the MTA server name, keep the server visible in the official master-list, then verify control before the challenge expires.",
      },
      { status: 201, headers: privateHeaders },
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode, headers: privateHeaders },
      );
    }
    console.error("Server claim challenge issue error:", error);
    return NextResponse.json(
      { error: "Could not create server control challenge" },
      { status: 500, headers: privateHeaders },
    );
  }
}
