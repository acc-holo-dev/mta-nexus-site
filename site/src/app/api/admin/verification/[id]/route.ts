import { AppError, UnauthorizedError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../features/accounts/user-platform-api";
import { verificationRate } from "../../../../../features/trust/verification-workspace-api";
import { verificationDecisionSchema } from "../../../../../features/trust/verification-workspace-contract";
import { verificationDecisionError } from "../../../../../features/trust/verification-workspace-copy";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { verificationWorkspaceService } from "../../../../../lib/services/verification-workspace-service";
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
