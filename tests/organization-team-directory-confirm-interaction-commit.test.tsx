import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  actorId,
  createOrganizationTeamDirectoryConfirmInteractionHelpers,
  later,
  member,
  mockReactHooks,
  organization,
  page,
} from "./helpers/organization-team-directory-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../apps/web/src/lib/organization-workspace-client", () => ({
  organizationRequest: harness.request,
}));

import { OrganizationTeamDirectory } from "../apps/web/src/components/organization-team-directory";
import { organizationBatchCopy } from "../apps/web/src/lib/organization-batch-copy";
import { getOrganizationCopy } from "../apps/web/src/lib/organization-workspace-copy";

const { render, memberEditor } = createOrganizationTeamDirectoryConfirmInteractionHelpers(
  harness,
  OrganizationTeamDirectory,
  confirmAction,
);

it("confirms member removal before DELETE", async () => {
  const team = getOrganizationCopy("en");
  const batch = organizationBatchCopy("en");
  const refreshed = {
    ...page,
    organization: { ...organization, updatedAt: later },
  };
  harness.request
    .mockResolvedValueOnce({
      organization: refreshed.organization,
      userId: member.id,
      removed: true,
    })
    .mockResolvedValueOnce(refreshed);

  await (memberEditor(render()).props.onRemove as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.request).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: team.remove,
    object: `${member.displayName} (@${member.username})`,
    consequences: team.removeConfirm,
    confirmLabel: team.remove,
    cancelLabel: batch.cancel,
    closeLabel: batch.cancel,
  });
  expect(harness.request).toHaveBeenCalledWith(
    `/api/workspace/organizations/${encodeURIComponent(organization.id)}/members/${encodeURIComponent(member.id)}`,
    "en",
    "DELETE",
    { expectedUpdatedAt: organization.updatedAt },
    expect.any(AbortSignal),
    { "x-nexus-actor-id": actorId },
  );
});
