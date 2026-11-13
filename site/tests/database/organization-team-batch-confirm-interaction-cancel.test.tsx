import { expect, it, vi } from "vitest";
import {
  createOrganizationTeamBatchConfirmInteractionHelpers,
  data,
  mockReactHooks,
} from "../helpers/organization-team-batch-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  failure: vi.fn(),
  committed: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));

import { OrganizationTeamBatch } from "../../src/components/organization-team-batch";
import { organizationBatchCopy } from "../../src/lib/organization-batch-copy";

const { click, prepareRemoveReview } = createOrganizationTeamBatchConfirmInteractionHelpers(
  harness,
  OrganizationTeamBatch,
  confirmAction,
);

it("does not commit organization-team-batch removal when confirmAction is cancelled", async () => {
  const copy = organizationBatchCopy("en");
  await prepareRemoveReview();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  confirmAction.mockResolvedValueOnce(false);
  click("Save reviewed changes");
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.title,
    object: data.organization.name,
    scope: "1",
    consequences: copy.confirmRemove,
    confirmLabel: copy.confirm,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
  });
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(harness.acquire).toHaveBeenCalledTimes(1);
  expect(harness.committed).not.toHaveBeenCalled();
  expect(harness.failure).not.toHaveBeenCalled();
});
