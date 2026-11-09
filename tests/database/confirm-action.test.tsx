import { afterEach, beforeEach, expect, it, vi } from "vitest";

const capture = vi.hoisted(() => vi.fn());
const root = vi.hoisted(() => ({
  render: vi.fn((element: { type: (props: unknown) => null; props: unknown }) => {
    element.type(element.props);
  }),
  unmount: vi.fn(),
}));

vi.mock("@nexus/ui", () => ({
  ConfirmDialog: (props: {
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    confirmLabel: string;
    cancelLabel: string;
  }) => {
    capture(props);
    return null;
  },
}));
vi.mock("react-dom/client", () => ({
  createRoot: () => root,
}));

import { confirmAction } from "../../apps/web/src/components/confirm-action";

const request = {
  title: "Confirm",
  object: "Example",
  consequences: "This cannot be undone.",
  confirmLabel: "Continue",
  cancelLabel: "Cancel",
  closeLabel: "Cancel",
  danger: true,
};

beforeEach(() => {
  capture.mockClear();
  root.render.mockClear();
  root.unmount.mockClear();
  vi.stubGlobal("document", {
    createElement: () => ({
      dataset: {},
      remove: vi.fn(),
    }),
    body: { appendChild: vi.fn() },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it("resolves false when document is unavailable", async () => {
  vi.stubGlobal("document", undefined);
  await expect(confirmAction(request)).resolves.toBe(false);
});

it("resolves true on confirm and tears down the dialog host", async () => {
  const host = { dataset: {} as Record<string, string>, remove: vi.fn() };
  vi.stubGlobal("document", {
    createElement: () => host,
    body: { appendChild: vi.fn() },
  });
  const promise = confirmAction(request);
  expect(root.render).toHaveBeenCalledOnce();
  expect(capture).toHaveBeenCalledOnce();
  capture.mock.calls[0][0].onConfirm();
  await expect(promise).resolves.toBe(true);
  expect(root.unmount).toHaveBeenCalledOnce();
  expect(host.remove).toHaveBeenCalledOnce();
});

it("resolves false on cancel without accepting a later confirm", async () => {
  const promise = confirmAction(request);
  const props = capture.mock.calls[0][0];
  props.onCancel();
  await expect(promise).resolves.toBe(false);
  props.onConfirm();
  await expect(promise).resolves.toBe(false);
});
