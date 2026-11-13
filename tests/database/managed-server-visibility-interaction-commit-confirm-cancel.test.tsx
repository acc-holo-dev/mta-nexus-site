import { expect, it, vi } from "vitest";
import {
  createManagedServerVisibilityInteractionHelpers,
  mockReactHooks,
} from "../helpers/managed-server-visibility-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  confirm: vi.fn(),
  reload: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../../site/src/components/confirm-action", () => ({
  confirmAction: (...args: unknown[]) => harness.confirm(...args),
}));

import { ManagedServerVisibilityBatch } from "../../site/src/components/managed-server-visibility-batch";
import { getManagedServerCopy } from "../../site/src/lib/managed-server-view";
import { serverWorkspaceCopy } from "../../site/src/lib/server-workspace-copy";

const { render, commitBatch, review } = createManagedServerVisibilityInteractionHelpers(
  harness,
  ManagedServerVisibilityBatch,
);

it("does not commit managed-server visibility when confirmAction is cancelled", async () => {
  const copy = serverWorkspaceCopy("en");
  const labels = getManagedServerCopy("en");
  await review();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  harness.confirm.mockResolvedValueOnce(false);
  await commitBatch(() => render(), copy.confirm);
  await vi.waitFor(() => expect(harness.confirm).toHaveBeenCalledTimes(1));
  expect(harness.confirm).toHaveBeenCalledWith({
    title: copy.previewTitle,
    object: "2",
    scope: labels.private,
    consequences: copy.confirmWrite,
    confirmLabel: copy.confirm,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
  });
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(render().some((node) => node.props.children === copy.saved)).toBe(false);
});
