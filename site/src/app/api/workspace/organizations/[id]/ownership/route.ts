import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../../features/accounts/user-platform-api";
import { organizationGovernanceMutationError } from "../../../../../../features/organizations/organization-governance-copy";
import {
  organizationId,
  organizationInput,
  organizationMutationToken,
} from "../../../../../../features/organizations/organization-workspace-api";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
import { organizationGovernanceService } from "../../../../../../lib/services/organizations/organization-governance-service";
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
