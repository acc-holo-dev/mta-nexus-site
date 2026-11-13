import { expect, it, vi } from "vitest";
import {
  createResourceMediaEditorConfirmInteractionHelpers,
  mockReactHooks,
} from "../helpers/resource-media-editor-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));

import { ResourceMediaEditor } from "../../src/components/resource-media-editor";

const { render, removeButton } = createResourceMediaEditorConfirmInteractionHelpers(
  harness,
  ResourceMediaEditor,
  confirmAction,
);

it("keeps the gallery image when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (removeButton(render()).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
});
