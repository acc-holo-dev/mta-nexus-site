import type { NextRequest } from "next/server";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
import { organizationGovernanceMutationError } from "../../../../../../lib/organization-governance-copy";
import {
  organizationId,
  organizationInput,
} from "../../../../../../lib/organization-workspace-api";
import { organizationGovernanceService } from "../../../../../../lib/services/organization-governance-service";
import { userPlatformApi } from "../../../../../../lib/user-platform-api";
export const POST = withBrowserMutation(
  (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    return userPlatformApi(
      request,
      async (actor) =>
        organizationGovernanceService.transfer(
          organizationId((await context.params).id),
          actor,
          await organizationInput(request, actor),
        ),
      200,
      organizationGovernanceMutationError,
    );
  },
);
