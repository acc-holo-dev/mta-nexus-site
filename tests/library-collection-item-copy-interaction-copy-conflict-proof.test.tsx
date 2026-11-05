import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionItemCopyInteractionHelpers,
  mockReactHooks,
} from "./helpers/library-collection-item-copy-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { LibraryCollectionItemCopyForm } from "../apps/web/src/components/library-collection-item-copy";

const { render, submit, reviewed, success } = createLibraryCollectionItemCopyInteractionHelpers(
  harness,
  LibraryCollectionItemCopyForm,
);

it("does not accept a receipt with altered source proof", async () => {
  reviewed();
  harness.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) =>
    success(init, { command: { ...JSON.parse(String(init.body)), expectedSourceRevision: 9 } }),
  );
  await submit();
  expect(render().some((n) => n.props.role === "status")).toBe(false);
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
});

it("blocks stale handlers after a conflict and requires reload", async () => {
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
  expect(
    render()
      .filter((n) => n.type === "button")
      .every((n) => n.props.type === "button"),
  ).toBe(true);
  const button = render().find((n) => n.type === "button");
  if (!button) throw new Error("Missing reload action");
  (button.props.onClick as () => void)();
  expect(harness.refresh).toHaveBeenCalledOnce();
});
