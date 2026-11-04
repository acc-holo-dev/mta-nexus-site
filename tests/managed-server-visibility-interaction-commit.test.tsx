import { expect, it, vi } from "vitest";
import {
  ack,
  createManagedServerVisibilityInteractionHelpers,
  mockReactHooks,
  preview,
  response,
  time,
  token,
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

const { render, hasCopy, button, click, acknowledgeBatchCommit, commitBatch, selected, review } =
  createManagedServerVisibilityInteractionHelpers(harness, ManagedServerVisibilityBatch);

it.each(["en", "ru"] as const)(
  "reviews, freezes and confirms only the selected server identities in %s",
  async (locale) => {
    await review(locale);
    const nodes = render(locale),
      copy = serverWorkspaceCopy(locale);
    expect(nodes.find((node) => node.type === "fieldset")?.props.disabled).toBe(true);
    expect(
      nodes
        .filter(
          (node) =>
            node.type === "input" && node.props.id !== "managed-server-visibility-batch-commit",
        )
        .every((node) => node.props.disabled),
    ).toBe(true);
    expect(harness.fetch.mock.calls[0][0]).toBe("/api/workspace/servers/visibility/preview");
    expect(JSON.parse(harness.fetch.mock.calls[0][1].body)).toEqual({
      serverIds: ["a", "b"],
      visibility: "private",
    });
    harness.fetch.mockResolvedValue(response(ack));
    await commitBatch(() => render(locale), copy.confirm);
    await vi.waitFor(() =>
      expect(render(locale).some((node) => node.props.children === copy.saved)).toBe(true),
    );
    expect(JSON.parse(harness.fetch.mock.calls[1][1].body)).toEqual({
      serverIds: ["a", "b"],
      visibility: "private",
      previewRevision: token,
    });
    expect(harness.refresh).toHaveBeenCalledOnce();
    expect(button(render(locale), copy.reload).props.disabled).not.toBe(true);
  },
);
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
it.each(["preview", "write"])(
  "aborts requests on navigation and ignores late %s acknowledgements",
  async (stage) => {
    if (stage === "write") await review();
    let release: (value: Response) => void = () => {};
    harness.fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    if (stage === "preview") {
      selected();
      click(render(), serverWorkspaceCopy("en").preview);
    } else await commitBatch(() => render(), serverWorkspaceCopy("en").confirm);
    const signal = harness.fetch.mock.calls.at(-1)?.[1].signal as AbortSignal;
    harness.cleanups.forEach((cleanup) => {
      cleanup?.();
    });
    expect(signal.aborted).toBe(true);
    release(response(stage === "preview" ? preview : ack));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(harness.refresh).not.toHaveBeenCalled();
    expect(render().some((node) => node.props.children === serverWorkspaceCopy("en").saved)).toBe(
      false,
    );
  },
);
it("retains confirmed success if refreshing the page fails", async () => {
  await review();
  harness.refresh.mockImplementationOnce(() => {
    throw Error("Refresh failed");
  });
  harness.fetch.mockResolvedValueOnce(response(ack));
  await commitBatch(() => render(), serverWorkspaceCopy("en").confirm);
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.children === serverWorkspaceCopy("en").saved)).toBe(
      true,
    ),
  );
  expect(hasCopy(render(), serverWorkspaceCopy("en").unavailable)).toBe(true);
});
