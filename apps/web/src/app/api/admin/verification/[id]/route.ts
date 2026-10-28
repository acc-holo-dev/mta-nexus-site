import type { NextRequest } from "next/server";
import { AppError, UnauthorizedError } from "@nexus/domain";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
import { verificationDecisionError } from "../../../../../lib/verification-workspace-copy";
import { verificationDecisionSchema } from "../../../../../lib/verification-workspace-contract";
import { verificationRate } from "../../../../../lib/verification-workspace-api";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../lib/bounded-json";
import { verificationWorkspaceService } from "../../../../../lib/services/verification-workspace-service";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
export const PATCH = withBrowserMutation(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    return userPlatformApi(
      request,
      async (actor) => {
        const { id } = await context.params;
        if (!/^[a-zA-Z0-9_-]{1,128}$/u.test(id))
          throw new AppError("Invalid id", 400, "VALIDATION_ERROR");
        requireServerJsonContentType(request);
        const parsed = verificationDecisionSchema.safeParse(await readBoundedJson(request));
        if (!parsed.success) throw new AppError("Invalid decision", 400, "VALIDATION_ERROR");
        const token = request.cookies.get("nexus_session")?.value;
        if (!token) throw new UnauthorizedError();
        await verificationRate(actor.id, "moderationAction");
        return verificationWorkspaceService.decide(actor, id, parsed.data, token);
      },
      200,
      verificationDecisionError,
    );
  },
);
