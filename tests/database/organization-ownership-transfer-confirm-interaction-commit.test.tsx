import { expect, it, vi } from "vitest";
import {
  actorId,
  createOrganizationOwnershipTransferConfirmInteractionHelpers,
  mockReactHooks,
  organization,
  target,
  transferResult,
} from "../helpers/organization-ownership-transfer-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  request: vi.fn(),
  onBusyChange: vi.fn(),
  onCancel: vi.fn(),
  onSaved: vi.fn(),
  onReload: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../../apps/web/src/lib/user-platform-client", async (original) => {
  const actual = await original<typeof import("../../apps/web/src/lib/user-platform-client")>();
  return {
    ...actual,
    platformRequest: harness.request,
  };
});

import { OrganizationOwnershipTransfer } from "../../apps/web/src/components/organization-ownership-transfer";
import { organizationGovernanceCopy } from "../../apps/web/src/lib/organization-governance-copy";

const { render, submit } = createOrganizationOwnershipTransferConfirmInteractionHelpers(
  harness,
  OrganizationOwnershipTransfer,
  confirmAction,
);

it("confirms ownership transfer before POST", async () => {
  const copy = organizationGovernanceCopy("en");
  harness.request.mockResolvedValueOnce(transferResult);

  await submit(render());
  await vi.waitFor(() => expect(harness.request).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.transfer,
    object: `@${target.username} · ${organization.name}`,
    scope: copy.selected,
    consequences: copy.consequence,
    confirmLabel: copy.submit,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
  });
  expect(harness.request).toHaveBeenCalledWith(
    `/api/workspace/organizations/${encodeURIComponent(organization.id)}/ownership`,
    "en",
    "POST",
    {
      targetId: target.id,
      targetUsername: target.username,
      confirmationSlug: organization.slug,
      currentPassword: "Current-password-123!",
      formerOwnerRole: "member",
      expectedUpdatedAt: organization.updatedAt,
    },
    expect.any(AbortSignal),
    expect.any(Function),
    { "x-nexus-actor-id": actorId },
  );
  expect(harness.onSaved).toHaveBeenCalledWith(transferResult);
});
