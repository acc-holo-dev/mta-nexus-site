import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionsInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-collections-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  cleanup: null as (() => void) | null,
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../site/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh, push: harness.push }),
}));

import { LibraryCollectionCommandForm } from "../../site/src/components/library-collection-command";

const { collection, render, submit, success } = createLibraryCollectionsInteractionHelpers(
  harness,
  LibraryCollectionCommandForm,
  confirmAction,
);

it("prevents rapid double submission and never retries a confirmed command", async () => {
  let resolve: (v: unknown) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const tree = render(),
    pending = submit(tree);
  await submit(tree);
  expect(harness.fetch).toHaveBeenCalledOnce();
  const command = JSON.parse(String(harness.fetch.mock.calls[0]?.[1].body));
  resolve(success(command, { ...collection, revision: 5 }));
  await pending;
  await submit(render());
  expect(harness.fetch).toHaveBeenCalledOnce();
});

it.each([400, 401, 403, 404, 409, 413, 415])(
  "blocks stale handlers after definitive status %s",
  async (status) => {
    const tree = render("remove", undefined, {
      returnHref: "/workspace/library/prd_a/collections",
    });
    harness.fetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ code: "COLLECTION_CONFLICT" }),
    });
    await submit(tree);
    await submit(tree);
    expect(harness.fetch).toHaveBeenCalledOnce();
    const current = render();
    expect(current.find((n) => n.type === "button")?.props.disabled).toBe(true);
    expect(current.find((n) => n.type === "a")?.props.href).toBe(
      "/workspace/library/prd_a/collections",
    );
  },
);
