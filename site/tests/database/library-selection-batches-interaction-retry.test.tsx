import { expect, it, vi } from "vitest";
import {
  createLibrarySelectionBatchesInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-selection-batches-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { LibrarySelectionBatchControls } from "../../src/components/library-selection-batch-controls";

const { render, checks, change, click, reviewed, response } =
  createLibrarySelectionBatchesInteractionHelpers(harness, LibrarySelectionBatchControls);

it("retries exactly the frozen UUID, digest and membership after a lost response", async () => {
  await reviewed();
  const confirmation = checks().at(-1);
  if (!confirmation) throw new Error("Missing confirmation");
  change(confirmation, true);
  harness.fetch.mockRejectedValueOnce(new Error("lost"));
  await click("Apply batch");
  const init = harness.fetch.mock.calls[1][1] as RequestInit,
    command = JSON.parse(String(init.body));
  expect(render().find((n) => n.type === "fieldset")?.props.disabled).toBe(true);
  harness.fetch.mockResolvedValueOnce(response(command));
  await click("Retry the same request");
  expect(harness.fetch.mock.calls[2][1].body).toBe(init.body);
  expect(harness.refresh).toHaveBeenCalledOnce();
});
