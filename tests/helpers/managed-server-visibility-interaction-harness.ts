import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, vi, type Mock } from "vitest";
import {
  findTestButton,
  flattenReactTestTree,
  type FlatTestElement,
} from "./flatten-react-test-tree";
import { serverWorkspaceCopy } from "../../apps/web/src/lib/server-workspace-copy";

export type ManagedServerVisibilityHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: (() => void)[];
  fetch: Mock;
  refresh: Mock;
  confirm: Mock;
  reload: Mock;
};

export type ManagedServerVisibilityBatchComponent = (props: {
  items: { id: string; name: string; card: ReactNode }[];
  locale: "en" | "ru";
}) => ReactNode;

export type Element = FlatTestElement;

export const time = "2026-10-12T00:00:00.123456Z",
  next = "2026-10-12T00:00:00.124456Z",
  token = "a".repeat(64);

export const items = [
  { id: "a", name: "Personal", card: "Personal card" },
  { id: "b", name: "Team", card: "Team card" },
];

export const preview = {
  visibility: "private",
  previewRevision: token,
  items: items.map((item) => ({
    id: item.id,
    name: item.name,
    status: "active",
    organization: item.id === "b",
    before: "public",
    after: "private",
    changed: true,
    revision: time,
  })),
};

export const ack = {
  visibility: "private",
  previewRevision: token,
  items: items.map((item) => ({
    id: item.id,
    visibility: "private",
    changed: true,
    revision: next,
  })),
};

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for visibility interaction suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ManagedServerVisibilityHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = initial;
      return [
        harness.slots[index],
        (value: unknown) => {
          harness.slots[index] = typeof value === "function" ? value(harness.slots[index]) : value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = { current: initial };
      return harness.slots[index];
    },
    useEffect: (effect: () => () => void) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) {
        harness.slots[index] = true;
        harness.cleanups.push(effect());
      }
    },
  });
}

export function createManagedServerVisibilityInteractionHelpers(
  harness: ManagedServerVisibilityHarness,
  ManagedServerVisibilityBatch: ManagedServerVisibilityBatchComponent,
) {
  function render(locale: "en" | "ru" = "en", rows = items) {
    harness.cursor = 0;
    return flattenReactTestTree(ManagedServerVisibilityBatch({ items: rows, locale }));
  }

  function hasCopy(nodes: Element[], text: string) {
    return nodes.some(
      (node) =>
        node.props.children === text ||
        node.props.title === text ||
        (typeof node.type !== "string" &&
          (node.type as { name?: string }).name === "ErrorState" &&
          node.props.title === text),
    );
  }

  const button = findTestButton;

  function click(nodes: Element[], label: string) {
    return (button(nodes, label).props.onClick as () => void)();
  }

  function acknowledgeBatchCommit(nodes: Element[]) {
    const checkbox = nodes.find(
      (node) =>
        node.type === "input" &&
        node.props.type === "checkbox" &&
        typeof node.props.id === "string" &&
        (node.props.id.includes("batch-commit") ||
          node.props.id === "managed-server-visibility-batch-commit"),
    );
    if (!checkbox) throw Error("Missing batch commit acknowledgement");
    (checkbox.props.onChange as (event: { target: { checked: boolean } }) => void)({
      target: { checked: true },
    });
  }

  async function commitBatch(renderFn: () => Element[], label: string) {
    acknowledgeBatchCommit(renderFn());
    await (button(renderFn(), label).props.onClick as () => Promise<void>)();
  }

  function selected(locale: "en" | "ru" = "en") {
    click(render(locale), serverWorkspaceCopy(locale).selectAll);
  }

  async function review(locale: "en" | "ru" = "en") {
    selected(locale);
    click(render(locale), serverWorkspaceCopy(locale).preview);
    await vi.waitFor(() =>
      expect(
        render(locale).some((node) => node.props.children === serverWorkspaceCopy(locale).confirm),
      ).toBe(true),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanups = [];
    harness.confirm.mockResolvedValue(true);
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("window", { location: { reload: harness.reload } });
    harness.fetch.mockResolvedValue(response(preview));
  });

  afterEach(() => {
    harness.cleanups.forEach((cleanup) => {
      cleanup?.();
    });
    vi.unstubAllGlobals();
  });

  return {
    render,
    hasCopy,
    button,
    click,
    acknowledgeBatchCommit,
    commitBatch,
    selected,
    review,
  };
}
