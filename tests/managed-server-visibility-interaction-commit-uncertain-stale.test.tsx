import { expect, it, vi } from "vitest";
import {
  ack,
  createManagedServerVisibilityInteractionHelpers,
  mockReactHooks,
  response,
  time,
} from "./helpers/managed-server-visibility-interaction-harness";

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
vi.mock("../apps/web/src/components/confirm-action", () => ({
  confirmAction: (...args: unknown[]) => harness.confirm(...args),
}));

import { ManagedServerVisibilityBatch } from "../apps/web/src/components/managed-server-visibility-batch";
import { serverWorkspaceCopy } from "../apps/web/src/lib/server-workspace-copy";

const { render, hasCopy, button, click, acknowledgeBatchCommit, commitBatch, review } =
  createManagedServerVisibilityInteractionHelpers(harness, ManagedServerVisibilityBatch);

it.each(["revision", "scope", "network"])(
  "requires refresh after an unconfirmed write and blocks retained handlers (%s)",
  async (kind) => {
    await review();
    if (kind === "network") harness.fetch.mockRejectedValueOnce(Error("Private transport details"));
    else
      harness.fetch.mockResolvedValueOnce(
        response({
          ...ack,
          items: ack.items.map((item, i) => ({
            ...item,
            ...(i === 0 ? (kind === "revision" ? { revision: time } : { id: "foreign" }) : {}),
          })),
        }),
      );
    const retainedCommit = button(render(), serverWorkspaceCopy("en").confirm);
    acknowledgeBatchCommit(render());
    await (
      button(render(), serverWorkspaceCopy("en").confirm).props.onClick as () => Promise<void>
    )();
    await vi.waitFor(() =>
      expect(hasCopy(render(), serverWorkspaceCopy("en").uncertain)).toBe(true),
    );
    await (retainedCommit.props.onClick as () => Promise<void>)();
    expect(harness.fetch).toHaveBeenCalledTimes(2);
    expect(harness.refresh).not.toHaveBeenCalled();
    expect(render().some((node) => String(node.props.children).includes("Private transport"))).toBe(
      false,
    );
    click(render(), serverWorkspaceCopy("en").reload);
    expect(harness.refresh).toHaveBeenCalledOnce();
    expect(harness.reload).not.toHaveBeenCalled();
  },
);
it("shows a safe stale-review error and does not retry it automatically", async () => {
  await review();
  harness.fetch.mockResolvedValueOnce(
    response({ code: "SERVER_BATCH_CHANGED", error: "Sensitive server information" }, 409),
  );
  await commitBatch(() => render(), serverWorkspaceCopy("en").confirm);
  await vi.waitFor(() => expect(hasCopy(render(), serverWorkspaceCopy("en").changed)).toBe(true));
  expect(harness.fetch).toHaveBeenCalledTimes(2);
  expect(harness.refresh).not.toHaveBeenCalled();
});
