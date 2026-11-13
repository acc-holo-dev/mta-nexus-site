import { expect, it, vi } from "vitest";
import {
  createLibraryMembershipBatchesInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-membership-batches-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { LibraryMembershipBatchForm } from "../../site/src/components/library-membership-batch";

const { state, render, check, submit, reviewed, success } =
  createLibraryMembershipBatchesInteractionHelpers(harness, LibraryMembershipBatchForm);

it("blocks stale handlers after a conflict or confirmed result", async () => {
  reviewed();
  const tree = render();
  harness.fetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({ code: "COLLECTION_CONFLICT" }),
  });
  await submit(tree);
  await submit(tree);
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(render().find((n) => n.type === "button")?.props.disabled).toBe(true);
});

it("permits lost-access removals and keeps the final orphan-removal receipt visible", async () => {
  state.report.resource.canAdd = false;
  check(0, false);
  check(2, true);
  harness.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => success(init));
  await submit();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(render().some((n) => n.props.role === "status")).toBe(true);
});

it("never repeats a confirmed group through a stale submission handler", async () => {
  reviewed();
  harness.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => success(init));
  const tree = render();
  await submit(tree);
  await submit(tree);
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(harness.refresh).toHaveBeenCalledOnce();
});
