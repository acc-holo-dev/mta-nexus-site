import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionsBatchInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-collections-batch-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { LibraryCollectionBatchForm } from "../../apps/web/src/components/library-collection-batch";

const { collection, items, render, check, submit } =
  createLibraryCollectionsBatchInteractionHelpers(harness, LibraryCollectionBatchForm);

it("requires explicit acknowledgement and clears it whenever selection changes", async () => {
  check(0);
  await submit();
  expect(harness.fetch).not.toHaveBeenCalled();
  check(2);
  check(1);
  await submit();
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(render().find((n) => n.type === "button")?.props.disabled).toBe(true);
});

it("blocks add selection without access but allows its removal", () => {
  expect(render("add-many").filter((n) => n.type === "input")[1]?.props.disabled).toBe(true);
  expect(render().filter((n) => n.type === "input")[1]?.props.disabled).toBe(false);
});

it("caps selected references at twenty and permits deselecting a selected reference", () => {
  const entries = Array.from({ length: 21 }, (_, i) => ({
    productId: `prd_${i}`,
    title: `Resource ${i}`,
    hasAccess: true,
  }));
  for (let i = 0; i < 20; i++) check(i, true, "remove-many", entries);
  const inputs = render("remove-many", entries).filter((n) => n.type === "input");
  expect(inputs[20]?.props.disabled).toBe(true);
  expect(inputs[0]?.props.disabled).toBe(false);
  check(0, false, "remove-many", entries);
  expect(render("remove-many", entries).filter((n) => n.type === "input")[20]?.props.disabled).toBe(
    false,
  );
});

it("invalidates pre-submit acknowledgement when the reviewed snapshot changes", async () => {
  check(0);
  check(2);
  const changed = render("remove-many", items, { collection: { ...collection, revision: 5 } });
  expect(changed.filter((n) => n.type === "input")[2]?.props.checked).toBe(false);
  await submit(changed);
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("does not allow a stale checkbox handler to bypass disabled access or selection capacity", async () => {
  const inputs = render("add-many", items, { maxSelection: 0 }).filter((n) => n.type === "input");
  const first = inputs[0],
    second = inputs[1];
  if (!first || !second) throw Error("Missing choice");
  (first.props.onChange as (e: unknown) => void)({ target: { checked: true } });
  (second.props.onChange as (e: unknown) => void)({ target: { checked: true } });
  expect(
    render("add-many", items, { maxSelection: 0 }).filter((n) => n.type === "input")[0]?.props
      .checked,
  ).toBe(false);
  expect(harness.fetch).not.toHaveBeenCalled();
});
