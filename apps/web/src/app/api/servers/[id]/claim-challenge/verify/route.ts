import { after, type NextRequest, NextResponse } from "next/server";
import { createRequestLogContext, logRequestEvent } from "../../../../../../lib/observability";
import { z } from "zod";
import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { authService } from "../../../../../../lib/services/auth-service";
import {
  notifyModeratorsOfServerClaim,
  serverClaimService,
} from "../../../../../../lib/services/server-claim-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

const verifySchema = z.object({
  challengeId: z
    .string()
    .regex(/^scc_[0-9a-f-]{36}$/u)
    .max(64),
  token: z
    .string()
    .regex(/^NXCLAIM-[A-F0-9]{24}$/u),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = createRequestLogContext(request);
  try {
    const sessionToken = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(sessionToken);
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

    const parsed = verifySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid server control proof" },
        { status: 400, headers: privateHeaders },
      );
    }

    const { id: serverId } = await params;
    if (!serverId || serverId.length > 128) {
      return NextResponse.json(
        { error: "Server not found" },
        { status: 404, headers: privateHeaders },
      );
    }

    const {
      moderatorNotification,
      ...result
    } = await serverClaimService.verifyChallenge(
      {
        serverId,
        challengeId: parsed.data.challengeId,
        token: parsed.data.token,
      },
      user,
    );

    after(async () => {
      await notifyModeratorsOfServerClaim(
        moderatorNotification.serverName,
      );
    });

    return NextResponse.json(result, {
      status: 201,
      headers: privateHeaders,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode, headers: privateHeaders },
      );
    }
    logRequestEvent({
      level: "error",
      event: "server.claim_challenge.verify_failed",
      context,
      status: 500,
      error,
    });
    return NextResponse.json(
      { error: "Could not verify server control" },
      { status: 500, headers: privateHeaders },
    );
  }
}
