import { expect, it, vi } from "vitest";
import {
  ack,
  createManagedServerVisibilityInteractionHelpers,
  mockReactHooks,
  preview,
  response,
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
import { serverWorkspaceCopy } from "../../site/src/lib/server-workspace-copy";

const { render, hasCopy, button, click, acknowledgeBatchCommit, selected, review } =
  createManagedServerVisibilityInteractionHelpers(harness, ManagedServerVisibilityBatch);

it("cancels the reviewed selection before issuing a write", async () => {
  await review();
  click(render(), serverWorkspaceCopy("en").cancel);
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(render().find((node) => node.type === "fieldset")?.props.disabled).toBe(false);
});
it("bounds the selection to twenty, even when multiple old checkbox handlers fire before rerender", () => {
  const rows = Array.from({ length: 21 }, (_, i) => ({
    id: `s${i}`,
    name: `Server ${i}`,
    card: "card",
  }));
  const inputs = render("en", rows).filter((node) => node.type === "input");
  inputs.forEach((node) => {
    (node.props.onChange as () => void)();
  });
  const state = render("en", rows).filter((node) => node.type === "input");
  expect(state.filter((node) => node.props.checked)).toHaveLength(20);
  expect(state[20].props.disabled).toBe(true);
});
it("does not issue a command when all reviewed values already match", async () => {
  harness.fetch.mockResolvedValue(
    response({
      ...preview,
      items: preview.items.map((item) => ({ ...item, before: "private", changed: false })),
    }),
  );
  await review();
  const commit = button(render(), serverWorkspaceCopy("en").confirm);
  expect(commit.props.disabled).toBe(true);
  (commit.props.onClick as () => void)();
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(render().some((node) => node.props.children === serverWorkspaceCopy("en").noChanges)).toBe(
    true,
  );
});
it("coalesces repeated preview and confirmation clicks and blocks replay after confirmed success", async () => {
  let release: (value: Response) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  selected();
  const old = button(render(), serverWorkspaceCopy("en").preview);
  (old.props.onClick as () => void)();
  (old.props.onClick as () => void)();
  expect(harness.fetch).toHaveBeenCalledOnce();
  release(response(preview));
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.children === serverWorkspaceCopy("en").confirm)).toBe(
      true,
    ),
  );
  harness.fetch.mockResolvedValue(response(ack));
  acknowledgeBatchCommit(render());
  const commit = button(render(), serverWorkspaceCopy("en").confirm);
  await (commit.props.onClick as () => Promise<void>)();
  await (commit.props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledOnce());
  (commit.props.onClick as () => void)();
  expect(harness.fetch).toHaveBeenCalledTimes(2);
});
it.each(["foreign", "duplicate", "extra", "changed"])(
  "does not expose an active confirm action for a mismatched preview (%s)",
  async (kind) => {
    const data = structuredClone(preview);
    if (kind === "foreign") data.items[0].id = "foreign";
    if (kind === "duplicate") data.items[1] = data.items[0];
    if (kind === "changed") data.items[0].changed = false;
    harness.fetch.mockResolvedValue(
      response(kind === "extra" ? { ...data, ownerId: "private" } : data),
    );
    selected();
    click(render(), serverWorkspaceCopy("en").preview);
    await vi.waitFor(() =>
      expect(hasCopy(render(), serverWorkspaceCopy("en").unavailable)).toBe(true),
    );
    expect(render().some((node) => node.props.children === serverWorkspaceCopy("en").confirm)).toBe(
      false,
    );
    expect(harness.fetch).toHaveBeenCalledOnce();
  },
);
