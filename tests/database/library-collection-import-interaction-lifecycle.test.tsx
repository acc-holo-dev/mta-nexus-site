import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionImportInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-collection-import-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));

import { LibraryCollectionBatchForm } from "../../apps/web/src/components/library-collection-batch";
import { LibraryCollectionImport } from "../../apps/web/src/components/library-collection-import";

const { manifest, response, render, textarea, inspect, readFile, child } =
  createLibraryCollectionImportInteractionHelpers(
    harness,
    LibraryCollectionImport,
    LibraryCollectionBatchForm,
  );

it("locks parent controls and stale handlers when child mutation starts", async () => {
  textarea();
  harness.fetch.mockResolvedValueOnce(response());
  await inspect();
  const node = child();
  if (!node) throw Error("Missing add form");
  const tree = render();
  (node.props.onFreeze as () => void)();
  textarea("new file");
  readFile({ size: 5, text: async () => "other" });
  await inspect(tree);
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(child()?.props.items).toEqual([
    { productId: "prd_a", title: "Available", hasAccess: true },
  ]);
  expect(render().find((n) => n.type === "fieldset")?.props.disabled).toBe(true);
});

it("aborts stale preview reads and ignores their late response after text changes", async () => {
  textarea();
  let finish: (value: unknown) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const running = inspect();
  const init = harness.fetch.mock.calls[0]?.[1] as RequestInit;
  textarea(JSON.stringify({ ...manifest(), productIds: [] }));
  expect(init.signal?.aborted).toBe(true);
  finish(response());
  await running;
  expect(child()).toBeUndefined();
});

it("aborts on unmount and never applies a late preview", async () => {
  textarea();
  let finish: (value: unknown) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tree = render(),
    running = inspect(tree);
  const init = harness.fetch.mock.calls[0]?.[1] as RequestInit;
  harness.cleanup?.();
  expect(init.signal?.aborted).toBe(true);
  finish(response());
  await running;
  await inspect(tree);
  expect(child()).toBeUndefined();
  expect(harness.fetch).toHaveBeenCalledOnce();
});

it("bounds local files and ignores stale asynchronous file reads", async () => {
  const large = vi.fn(async () => "large");
  readFile({ size: 65537, text: large });
  expect(large).not.toHaveBeenCalled();
  let finish: (text: string) => void = () => {};
  readFile({
    size: 100,
    text: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  textarea("New pasted text");
  finish(JSON.stringify(manifest()));
  await Promise.resolve();
  await Promise.resolve();
  expect(render().find((n) => n.type === "textarea")?.props.value).toBe("New pasted text");
});

it("prevents concurrent preview submissions through stale handlers", async () => {
  textarea();
  let finish: (value: unknown) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tree = render(),
    running = inspect(tree);
  await inspect(tree);
  expect(harness.fetch).toHaveBeenCalledOnce();
  finish(response());
  await running;
});
