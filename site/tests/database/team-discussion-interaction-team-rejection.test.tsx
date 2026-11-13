import { expect, it, vi } from "vitest";
import {
  createTeamBatchInteractionHelpers,
  mockReactHooks,
  preview,
  response,
} from "../helpers/team-discussion-interaction-harness";

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
vi.mock("../../src/components/confirm-action", () => ({
  confirmAction: vi.fn(async () => true),
}));

import { OrganizationTeamBatch } from "../../src/components/organization-team-batch";

const { render, click, prepareTeam } = createTeamBatchInteractionHelpers(
  harness,
  OrganizationTeamBatch,
);

it("rejects mismatched reviews and acknowledgments without applying client state", async () => {
  prepareTeam();
  harness.fetch.mockResolvedValueOnce(response({ ...preview, organizationId: "foreign" }));
  click("Review changes");
  await vi.waitFor(() => expect(harness.failure).toHaveBeenCalled());
  expect(harness.committed).not.toHaveBeenCalled();
  expect(render().some((node) => node.props.children === "Save reviewed changes")).toBe(false);
});
