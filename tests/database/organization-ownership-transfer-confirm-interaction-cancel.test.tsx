import { expect, it, vi } from "vitest";
import {
  createOrganizationOwnershipTransferConfirmInteractionHelpers,
  mockReactHooks,
  organization,
  target,
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

it("does not transfer ownership when confirmation is cancelled", async () => {
  const copy = organizationGovernanceCopy("en");
  confirmAction.mockResolvedValueOnce(false);

  await submit(render());
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.transfer,
    object: `@${target.username} · ${organization.name}`,
    scope: copy.selected,
    consequences: copy.consequence,
    confirmLabel: copy.submit,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
  });
  expect(harness.request).not.toHaveBeenCalled();
  expect(harness.onSaved).not.toHaveBeenCalled();
});
