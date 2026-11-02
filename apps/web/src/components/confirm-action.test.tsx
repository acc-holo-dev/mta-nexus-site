import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dialog = vi.hoisted(() => ({
  props: null as null | {
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
  },
  unmount: vi.fn(),
}));

vi.mock("@nexus/ui", () => ({
  ConfirmDialog: (props: { onConfirm: () => void; onCancel: () => void; title: string }) => {
    dialog.props = props;
    return null;
  },
}));

vi.mock("react-dom/client", () => ({
  createRoot: () => ({
    render: (element: { props: typeof dialog.props }) => {
      dialog.props = element.props;
    },
    unmount: dialog.unmount,
  }),
}));

describe("confirmAction", () => {
  beforeEach(() => {
    dialog.props = null;
    dialog.unmount.mockClear();
    const body = {
      children: [] as Array<{ remove: () => void; dataset: Record<string, string> }>,
      appendChild(node: { remove: () => void; dataset: Record<string, string> }) {
        this.children.push(node);
        return node;
      },
      querySelector(selector: string) {
        if (selector !== "[data-nexus-confirm='true']") return null;
        return this.children.find((child) => child.dataset.nexusConfirm === "true") ?? null;
      },
    };
    vi.stubGlobal("document", {
      createElement(tag: string) {
        if (tag !== "div") throw new Error(`unexpected tag ${tag}`);
        const node = {
          dataset: {} as Record<string, string>,
          remove() {
            body.children = body.children.filter((child) => child !== node);
          },
        };
        return node;
      },
      body,
      querySelector: (selector: string) => body.querySelector(selector),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves true after confirm and removes the host", async () => {
    const { confirmAction } = await import("./confirm-action");
    const pending = confirmAction({
      title: "Retire build",
      object: "1.0.0",
      scope: "This resource",
      consequences: "Build becomes unavailable.",
      confirmLabel: "Retire",
      cancelLabel: "Cancel",
      closeLabel: "Close",
    });
    expect(document.querySelector("[data-nexus-confirm='true']")).toBeTruthy();
    expect(dialog.props?.title).toBe("Retire build");
    dialog.props?.onConfirm();
    await expect(pending).resolves.toBe(true);
    expect(dialog.unmount).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-nexus-confirm='true']")).toBeNull();
  });

  it("resolves false after cancel without leaving a host", async () => {
    const { confirmAction } = await import("./confirm-action");
    const pending = confirmAction({
      title: "Remove item",
      object: "cart",
      scope: "Cart",
      consequences: "Item is removed.",
      confirmLabel: "Remove",
      cancelLabel: "Keep",
      closeLabel: "Close",
    });
    dialog.props?.onCancel();
    await expect(pending).resolves.toBe(false);
    expect(dialog.unmount).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-nexus-confirm='true']")).toBeNull();
  });

  it("resolves false when document is unavailable", async () => {
    vi.unstubAllGlobals();
    const { confirmAction } = await import("./confirm-action");
    await expect(
      confirmAction({
        title: "Unavailable",
        object: "x",
        consequences: "noop",
        confirmLabel: "Ok",
        cancelLabel: "Cancel",
        closeLabel: "Close",
      }),
    ).resolves.toBe(false);
  });

  it("ignores a second confirm after settle", async () => {
    const { confirmAction } = await import("./confirm-action");
    const pending = confirmAction({
      title: "Once",
      object: "x",
      consequences: "once",
      confirmLabel: "Ok",
      cancelLabel: "Cancel",
      closeLabel: "Close",
    });
    const first = dialog.props;
    first?.onConfirm();
    first?.onConfirm();
    first?.onCancel();
    await expect(pending).resolves.toBe(true);
    expect(dialog.unmount).toHaveBeenCalledTimes(1);
  });
});
