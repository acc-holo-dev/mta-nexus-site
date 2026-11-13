import { expect, it, vi } from "vitest";
import {
  ack,
  createManagedServerVisibilityInteractionHelpers,
  mockReactHooks,
  response,
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
vi.mock("../site/src/components/confirm-action", () => ({
  confirmAction: (...args: unknown[]) => harness.confirm(...args),
}));

import { ManagedServerVisibilityBatch } from "../site/src/components/managed-server-visibility-batch";
import { serverWorkspaceCopy } from "../site/src/lib/server-workspace-copy";

const { render, button, commitBatch, review } = createManagedServerVisibilityInteractionHelpers(
  harness,
  ManagedServerVisibilityBatch,
);

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
