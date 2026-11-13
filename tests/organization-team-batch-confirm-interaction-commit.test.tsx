import { expect, it, vi } from "vitest";
import {
  createOrganizationTeamBatchConfirmInteractionHelpers,
  data,
  later,
  mockReactHooks,
  response,
  time,
  version,
} from "./helpers/organization-team-batch-confirm-interaction-harness";

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
vi.mock("../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));

import { OrganizationTeamBatch } from "../site/src/components/organization-team-batch";
import { organizationBatchCopy } from "../site/src/lib/organization-batch-copy";

const { acknowledgeCommit, click, prepareRemoveReview } =
  createOrganizationTeamBatchConfirmInteractionHelpers(
    harness,
    OrganizationTeamBatch,
    confirmAction,
  );

it("commits organization-team-batch removal only after confirmAction approves", async () => {
  const copy = organizationBatchCopy("en");
  await prepareRemoveReview();
  harness.fetch.mockResolvedValueOnce(
    response({
      organization: { ...data.organization, updatedAt: later },
      changedUserIds: ["member"],
      previewRevision: version,
    }),
  );
  acknowledgeCommit();
  click("Save reviewed changes");
  await vi.waitFor(() => expect(harness.committed).toHaveBeenCalled());
  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.title,
    object: data.organization.name,
    scope: "1",
    consequences: copy.confirmRemove,
    confirmLabel: copy.confirm,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
  });
  expect(harness.fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(harness.fetch.mock.calls[1][1].body)).toEqual({
    userIds: ["member"],
    change: { action: "remove" },
    expectedUpdatedAt: time,
    previewRevision: version,
  });
  expect(harness.failure).not.toHaveBeenCalled();
});
