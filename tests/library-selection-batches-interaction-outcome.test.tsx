import { expect, it, vi } from "vitest";
import {
  createLibrarySelectionBatchesInteractionHelpers,
  mockReactHooks,
} from "./helpers/library-selection-batches-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { LibrarySelectionBatchControls } from "../site/src/components/library-selection-batch-controls";

const { render, checks, change, click, reviewed, response, preview } =
  createLibrarySelectionBatchesInteractionHelpers(harness, LibrarySelectionBatchControls);

it("does not acknowledge foreign receipt snapshots", async () => {
  await reviewed();
  const confirmation = checks().at(-1);
  if (!confirmation) throw new Error("Missing confirmation");
  change(confirmation, true);
  harness.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => {
    const r = response(JSON.parse(String(init.body)));
    const body = await r.json();
    body.receipt.snapshot.collectionId = "lcol_b";
    return { ok: true, json: async () => body };
  });
  await click("Apply batch");
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
});

it("coalesces duplicate preview clicks while a request is pending", async () => {
  change(checks()[0], true);
  let resolve: (value: unknown) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await click("Review changes");
  await click("Processing…");
  expect(harness.fetch).toHaveBeenCalledOnce();
  resolve({ ok: true, json: async () => preview });
  await new Promise((r) => setTimeout(r, 0));
});
