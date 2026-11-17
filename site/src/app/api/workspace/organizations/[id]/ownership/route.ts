import type { NextRequest } from "next/server";
import { organizationGovernanceMutationError } from "../../../../../../features/organizations/organization-governance-copy";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
import {
  organizationId,
  organizationInput,
  organizationMutationToken,
} from "../../../../../../lib/organization-workspace-api";
import { organizationGovernanceService } from "../../../../../../lib/services/organization-governance-service";
import { userPlatformApi } from "../../../../../../lib/user-platform-api";
export const POST = withBrowserMutation(
  (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    return userPlatformApi(
      request,
      async (actor) => {
        const currentToken = organizationMutationToken(request, actor);
        return organizationGovernanceService.transfer(
          organizationId((await context.params).id),
          actor,
          await organizationInput(request, actor),
          currentToken,
        );
      },
      200,
      organizationGovernanceMutationError,
    );
  },
);
