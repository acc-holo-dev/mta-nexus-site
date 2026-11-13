import { expect, it, vi } from "vitest";
import {
  createTeamBatchInteractionHelpers,
  data,
  later,
  mockReactHooks,
  preview,
  response,
  time,
  version,
} from "./helpers/team-discussion-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  refresh: vi.fn(),
  fetch: vi.fn(),
  confirm: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  failure: vi.fn(),
  committed: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../site/src/components/confirm-action", () => ({
  confirmAction: vi.fn(async () => true),
}));

import { OrganizationTeamBatch } from "../site/src/components/organization-team-batch";

const { render, button, click, acknowledgeTeamCommit, prepareTeam } =
  createTeamBatchInteractionHelpers(harness, OrganizationTeamBatch);

it("selects eligible page members, performs server review and commits only the reviewed command", async () => {
  prepareTeam();
  harness.fetch.mockResolvedValueOnce(response(preview));
  click("Review changes");
  await vi.waitFor(() =>
    expect(button(render(), "Save reviewed changes").props.disabled).toBe(true),
  );
  acknowledgeTeamCommit();
  expect(button(render(), "Save reviewed changes").props.disabled).toBe(false);
  expect(JSON.parse(harness.fetch.mock.calls[0][1].body)).toEqual({
    userIds: ["member"],
    change: { action: "role", role: "developer" },
    expectedUpdatedAt: time,
  });
  harness.fetch.mockResolvedValueOnce(
    response({
      organization: { ...data.organization, updatedAt: later },
      changedUserIds: ["member"],
      previewRevision: version,
    }),
  );
  acknowledgeTeamCommit();
  click("Save reviewed changes");
  await vi.waitFor(() => expect(harness.committed).toHaveBeenCalled());
  expect(JSON.parse(harness.fetch.mock.calls[1][1].body).previewRevision).toBe(version);
  expect(harness.failure).not.toHaveBeenCalled();
  expect(harness.release).toHaveBeenCalledTimes(2);
});
