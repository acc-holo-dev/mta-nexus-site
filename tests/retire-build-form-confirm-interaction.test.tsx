import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useId: () => "retire-reason",
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] =
          typeof value === "function"
            ? (value as (current: unknown) => unknown)(harness.slots[index])
            : value;
      },
    ];
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh }),
}));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { RetireBuildForm } from "../apps/web/src/components/author-resource-forms";
import { getDictionary } from "../apps/web/src/lib/i18n";

type Element = ReactElement<Record<string, unknown>>;

function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  const type = element.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [
      { ...element, type: "button" } as Element,
      ...descendants(element.props.children as ReactNode),
    ];
  }
  return [element, ...descendants(element.props.children as ReactNode)];
}

function render() {
  harness.cursor = 0;
  return descendants(
    RetireBuildForm({
      productId: "prd_aaaaaaaaaaaaaaaaaaaaaaaa",
      buildId: "bld_bbbbbbbbbbbbbbbbbbbbbbbb",
      version: "1.4.0",
      revision: 3,
    }),
  );
}

function submit(nodes: Element[], reason = "No longer maintained") {
  const form = nodes.find((node) => node.type === "form");
  if (!form) throw new Error("Missing retire form");
  const OriginalFormData = globalThis.FormData;
  vi.stubGlobal(
    "FormData",
    class extends OriginalFormData {
      constructor() {
        super();
        this.set("reason", reason);
      }
    },
  );
  return (
    form.props.onSubmit as (event: {
      preventDefault: () => void;
      currentTarget: object;
    }) => Promise<void>
  )({
    preventDefault() {},
    currentTarget: {},
  });
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  confirmAction.mockResolvedValue(true);
  harness.fetch.mockReset();
  harness.refresh.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("confirms build retirement before PATCH", async () => {
  const copy = getDictionary("en").authorResources;
  harness.fetch.mockResolvedValueOnce(
    response({
      build: {
        id: "bld_bbbbbbbbbbbbbbbbbbbbbbbb",
        productId: "prd_aaaaaaaaaaaaaaaaaaaaaaaa",
        status: "retired",
      },
    }),
  );

  await submit(render());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.retireConfirmTitle,
    object: "1.4.0",
    consequences: copy.retireHint,
    confirmLabel: copy.retire,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/products/prd_aaaaaaaaaaaaaaaaaaaaaaaa/builds/bld_bbbbbbbbbbbbbbbbbbbbbbbb",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({
        action: "retire",
        expectedRevision: 3,
        reason: "No longer maintained",
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("does not retire a build when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await submit(render());
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
});
