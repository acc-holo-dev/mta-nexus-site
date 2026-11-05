import { expect, it, vi } from "vitest";
import {
  createLibraryMembershipBatchesInteractionHelpers,
  mockReactHooks,
} from "./helpers/library-membership-batches-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { LibraryMembershipBatchForm } from "../apps/web/src/components/library-membership-batch";

const { state, render, check, submit, fixture } = createLibraryMembershipBatchesInteractionHelpers(
  harness,
  LibraryMembershipBatchForm,
);

it("clears review when a collection revision changes before the first request", async () => {
  check(0, false);
  check(1, true);
  check(2, true);
  state.report = {
    ...state.report,
    collections: state.report.collections.map((c) => ({ ...c, revision: c.revision + 1 })),
  };
  await submit();
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("does not offer additions into full or archived collections or without current access", () => {
  state.report.resource.canAdd = false;
  expect(render().filter((n) => n.type === "input")[1]?.props.disabled).toBe(true);
  state.report = fixture();
  state.report.collections = state.report.collections.map((c, i) =>
    i === 1 ? { ...c, itemCount: 200 } : c,
  );
  expect(render().filter((n) => n.type === "input")[1]?.props.disabled).toBe(true);
  state.report.collections = state.report.collections.map((c, i) =>
    i === 0 ? { ...c, status: "archived" } : c,
  );
  expect(render().filter((n) => n.type === "input")[0]?.props.disabled).toBe(true);
});

it("caps changed collections at twenty while allowing a selected change to be undone", () => {
  state.report.collections = Array.from({ length: 30 }, (_, i) => ({
    id: `lcol_${i}`,
    name: `Collection ${i}`,
    status: "active",
    revision: 1,
    itemCount: 0,
    inCollection: false,
  }));
  for (let i = 0; i < 20; i++) check(i, true);
  const inputs = render().filter((n) => n.type === "input");
  expect(inputs[20]?.props.disabled).toBe(true);
  expect(inputs[0]?.props.disabled).toBe(false);
  check(0, false);
  expect(render().filter((n) => n.type === "input")[20]?.props.disabled).toBe(false);
});
