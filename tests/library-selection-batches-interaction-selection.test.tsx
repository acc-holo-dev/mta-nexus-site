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

const { render, checks, click, reviewed } = createLibrarySelectionBatchesInteractionHelpers(
  harness,
  LibrarySelectionBatchControls,
);

it("requires selecting resources and explicit acknowledgement before applying", async () => {
  await click("Review changes");
  expect(harness.fetch).not.toHaveBeenCalled();
  await reviewed();
  await click("Apply batch");
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(harness.refresh).not.toHaveBeenCalled();
});

it("clears a preview when the choice changes and allows recovery from withdrawn pins in latest mode", async () => {
  await reviewed();
  const radio = render().find((n) => n.type === "input" && n.props.value === "latest");
  if (!radio) throw new Error("Missing latest mode");
  (radio.props.onChange as () => void)();
  expect(render().some((n) => n.type === "button" && n.props.children === "Apply batch")).toBe(
    false,
  );
  expect(checks()[1].props.disabled).toBe(false);
});
