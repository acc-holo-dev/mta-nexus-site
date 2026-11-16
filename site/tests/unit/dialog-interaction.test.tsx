import type { ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as Array<{ current: unknown }>,
  cursor: 0,
  effects: [] as Array<{ deps: unknown[]; cleanup?: () => void }>,
  pending: [] as Array<() => void>,
}));

vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useId: () => "dialog-id",
    useRef: (value: unknown) => {
      const index = harness.cursor++;
      harness.slots[index] ??= { current: value };
      return harness.slots[index];
    },
    useEffect: (effect: () => undefined | (() => void), deps: unknown[]) => {
      const index = harness.cursor++;
      const previous = harness.effects[index];
      if (!previous || deps.some((dep, n) => !Object.is(dep, previous.deps[n]))) {
        harness.pending.push(() => {
          previous?.cleanup?.();
          const cleanup = effect();
          harness.effects[index] = {
            deps,
            cleanup: typeof cleanup === "function" ? cleanup : undefined,
          };
        });
      }
    },
  };
});

import { ConfirmDialog, Dialog } from "../../packages/ui/src/dialog";

type Element = ReactElement<Record<string, unknown>>;
const fakeDialog = () => ({
  open: false,
  showModal: vi.fn(function (this: { open: boolean }) {
    this.open = true;
  }),
  close: vi.fn(function (this: { open: boolean }) {
    this.open = false;
  }),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  getBoundingClientRect: () => ({ left: 10, right: 110, top: 10, bottom: 110 }),
});

beforeEach(() => {
  harness.slots = [];
  harness.effects = [];
  harness.pending = [];
  vi.stubGlobal("document", { activeElement: null });
  vi.stubGlobal("HTMLElement", class {});
});
afterEach(() => {
  for (const effect of harness.effects) effect?.cleanup?.();
  vi.unstubAllGlobals();
});

function renderDialog(onClose: () => void, disableDismiss = false) {
  harness.cursor = 0;
  return Dialog({
    isOpen: true,
    title: "Confirm",
    onClose,
    disableDismiss,
    children: "body",
  }) as Element;
}

function flushEffects() {
  for (const effect of harness.pending.splice(0)) effect();
}

function click(dialog: Element, target: unknown, x: number, y: number) {
  const handler = dialog.props.onClick as (event: unknown) => void;
  handler({ target, currentTarget: target, clientX: x, clientY: y });
}

it("keeps the modal open and focus stable when the close callback changes", () => {
  const first = vi.fn();
  const second = vi.fn();
  const node = fakeDialog();
  let view = renderDialog(first);
  (view.props.ref as { current: unknown }).current = node;
  flushEffects();
  expect(node.showModal).toHaveBeenCalledOnce();
  view = renderDialog(second);
  flushEffects();
  expect(node.close).not.toHaveBeenCalled();
  expect(node.showModal).toHaveBeenCalledOnce();
  click(view, node, 0, 0);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledOnce();
});

it("blocks escape, backdrop and the close control while confirmation is busy", () => {
  const onCancel = vi.fn();
  const confirm = ConfirmDialog({
    isOpen: true,
    title: "Confirm",
    object: "Item",
    consequences: "Change it",
    confirmLabel: "Change",
    cancelLabel: "Cancel",
    onConfirm: vi.fn(),
    onCancel,
    busy: true,
  }) as Element;
  harness.cursor = 0;
  const view = Dialog(confirm.props as unknown as Parameters<typeof Dialog>[0]) as Element;
  const node = fakeDialog();
  click(view, node, 0, 0);
  const preventDefault = vi.fn();
  (view.props.onCancel as (event: unknown) => void)({ preventDefault });
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(onCancel).not.toHaveBeenCalled();
  expect(view.props["aria-busy"]).toBe(true);
  const wrapper = view.props.children as Element;
  const close = (wrapper.props.children as Element[])[0];
  expect(close.props.disabled).toBe(true);
});

it("does not move keyboard focus to controls excluded from the tab order", () => {
  const excluded = { tabIndex: -1, getClientRects: () => [1], focus: vi.fn() };
  const included = { tabIndex: 0, getClientRects: () => [1], focus: vi.fn() };
  const node = Object.assign(fakeDialog(), { querySelectorAll: () => [excluded, included] });
  vi.stubGlobal("document", { activeElement: included });
  vi.stubGlobal("getComputedStyle", () => ({ visibility: "visible" }));
  const view = renderDialog(vi.fn());
  (view.props.ref as { current: unknown }).current = node;
  flushEffects();
  const keydown = node.addEventListener.mock.calls.find(([type]) => type === "keydown")?.[1] as
    | ((event: unknown) => void)
    | undefined;
  expect(keydown).toBeDefined();
  const preventDefault = vi.fn();
  keydown?.({ key: "Tab", shiftKey: false, preventDefault });
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(included.focus).toHaveBeenCalledOnce();
  expect(excluded.focus).not.toHaveBeenCalled();
});
