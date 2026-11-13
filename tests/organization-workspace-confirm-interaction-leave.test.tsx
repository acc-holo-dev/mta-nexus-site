import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  actorId,
  createOrganizationWorkspaceConfirmInteractionHelpers,
  later,
  mockReactHooks,
  organization,
  time,
} from "./helpers/organization-workspace-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: harness.push, refresh: harness.refresh }),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../site/src/lib/organization-workspace-client", () => ({
  organizationRequest: harness.request,
}));

import { OrganizationWorkspacePanel } from "../site/src/components/organization-workspace";
import { organizationGovernanceCopy } from "../site/src/lib/organization-governance-copy";
import { getOrganizationCopy } from "../site/src/lib/organization-workspace-copy";

const { clickLeave } = createOrganizationWorkspaceConfirmInteractionHelpers(
  harness,
  OrganizationWorkspacePanel,
  confirmAction,
);

it("confirms leaving an organization before POST", async () => {
  const copy = getOrganizationCopy("en");
  const governance = organizationGovernanceCopy("en");
  harness.request.mockResolvedValueOnce({
    organization: { ...organization, updatedAt: later },
    userId: actorId,
    removed: true,
  });

  clickLeave();
  await vi.waitFor(() => expect(harness.request).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.leave,
    object: organization.name,
    consequences: copy.leaveConfirm,
    confirmLabel: copy.leave,
    cancelLabel: governance.cancel,
    closeLabel: governance.cancel,
  });
  expect(harness.request).toHaveBeenCalledWith(
    `/api/workspace/organizations/${encodeURIComponent(organization.id)}/leave`,
    "en",
    "POST",
    { expectedUpdatedAt: time },
    undefined,
    { "x-nexus-actor-id": "usr_member" },
  );
  expect(harness.push).toHaveBeenCalledWith("/workspace/organizations");
  expect(harness.refresh).toHaveBeenCalledOnce();
});
