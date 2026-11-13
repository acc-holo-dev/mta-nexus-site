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
vi.mock("../../site/src/components/confirm-action", () => ({
  confirmAction: vi.fn(async () => true),
}));

import { OrganizationTeamBatch } from "../../site/src/components/organization-team-batch";

const { render, button, prepareTeam } = createTeamBatchInteractionHelpers(
  harness,
  OrganizationTeamBatch,
);

it("coalesces simultaneous reviews and aborts on unmount without later state or parent callbacks", async () => {
  prepareTeam();
  let resolve!: (value: Response) => void;
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  const clickHandler = button(render(), "Review changes").props.onClick as () => void;
  clickHandler();
  clickHandler();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  for (const cleanup of harness.cleanups) cleanup();
  expect(harness.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  resolve(response(preview));
  await vi.waitFor(() => expect(harness.release).toHaveBeenCalled());
  expect(harness.failure).not.toHaveBeenCalled();
  expect(harness.committed).not.toHaveBeenCalled();
});
