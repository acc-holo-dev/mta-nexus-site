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
  useId: () => "build-controls",
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
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = { current: initial };
    return harness.slots[index];
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh }),
}));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" as const }),
}));

import { ResourceBuildControls } from "../apps/web/src/components/resource-build-controls";
import { getResourceBuildWorkspaceCopy } from "../apps/web/src/lib/resource-build-workspace-i18n";

type Element = ReactElement<Record<string, unknown>>;

const build = {
  id: "bld_cccccccccccccccccccccccc",
  productId: "prd_dddddddddddddddddddddddd",
  version: "2.0.0",
  status: "pending_review" as const,
  revision: 4,
  releaseNotes: "Ready",
  mtaVersionTarget: "1.6",
};

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
  // busy ref, current, pending, notes, target, reason, message, uncertain
  harness.slots = [
    { current: false },
    build,
    false,
    build.releaseNotes,
    build.mtaVersionTarget,
    "Retiring after review",
    "",
    false,
  ];
  harness.cursor = 0;
  return descendants(
    ResourceBuildControls({
      build,
      withdrawn: false,
      trustedScan: true,
    }),
  );
}

function button(nodes: Element[], label: string) {
  const found = nodes.find((node) => node.type === "button" && node.props.children === label);
  if (!found) throw new Error(`Missing ${label}`);
  return found;
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

it("confirms withdraw before PATCH", async () => {
  const copy = getResourceBuildWorkspaceCopy("en");
  harness.fetch.mockResolvedValueOnce(
    response({
      build: {
        ...build,
        status: "draft",
        revision: 5,
      },
    }),
  );

  (button(render(), copy.withdraw).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.withdrawConfirmTitle,
    object: `${build.version} · ${copy.revision} ${build.revision}`,
    consequences: copy.withdrawConfirm,
    confirmLabel: copy.withdraw,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    `/api/products/${build.productId}/builds/${build.id}`,
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({
        action: "withdraw",
        expectedRevision: 4,
        reason: "Retiring after review",
      }),
    }),
  );
});

it("confirms retire before PATCH", async () => {
  const copy = getResourceBuildWorkspaceCopy("en");
  harness.fetch.mockResolvedValueOnce(
    response({
      build: {
        ...build,
        status: "retired",
        revision: 5,
      },
    }),
  );

  (button(render(), copy.retire).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.retireConfirmTitle,
    object: `${build.version} · ${copy.revision} ${build.revision}`,
    consequences: copy.retirement,
    confirmLabel: copy.retire,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    `/api/products/${build.productId}/builds/${build.id}`,
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({
        action: "retire",
        expectedRevision: 4,
        reason: "Retiring after review",
      }),
    }),
  );
});

it("skips withdraw and retire when confirmation is cancelled", async () => {
  const copy = getResourceBuildWorkspaceCopy("en");
  confirmAction.mockResolvedValue(false);
  const nodes = render();
  (button(nodes, copy.withdraw).props.onClick as () => void)();
  (button(nodes, copy.retire).props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(2));
  expect(harness.fetch).not.toHaveBeenCalled();
});
