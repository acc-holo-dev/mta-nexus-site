import type { ReactElement, ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { GuestAuthLinks } from "../site/src/components/guest-auth-links";
import { getDictionary } from "../site/src/lib/i18n";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) {
      harness.slots[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
    }
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
  useCallback: (fn: unknown) => fn,
  useEffect: () => undefined,
  useId: () => "server-guest-auth-id",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/servers/demo-server",
}));

vi.mock("../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({
    locale: "en" as const,
    dictionary: getDictionary("en"),
  }),
}));

vi.mock("../site/src/components/confirm-action", () => ({
  confirmAction: vi.fn(async () => true),
}));

vi.mock("@nexus/ui", async () => {
  const { createElement } = await import("react");
  function Button({
    children,
    onClick,
    type,
    disabled,
    isLoading,
    variant,
  }: {
    children: ReactNode;
    onClick?: () => void;
    type?: string;
    disabled?: boolean;
    isLoading?: boolean;
    variant?: string;
  }) {
    return createElement(
      "button",
      {
        type: type ?? "button",
        onClick,
        disabled: disabled || isLoading,
        "data-variant": variant,
      },
      children,
    );
  }
  Button.displayName = "Button";
  function EmptyState({ title, description }: { title: string; description?: string }) {
    return createElement("div", { "data-ui": "empty-state" }, title, description);
  }
  function ErrorState({ title, action }: { title: string; action?: ReactNode }) {
    return createElement("div", { role: "alert", "data-ui": "error-state" }, title, action);
  }
  return { fieldClassBlock: "field-block", Button, EmptyState, ErrorState };
});

vi.stubGlobal("fetch", harness.fetch);

import { ServerClaimControlPanel } from "../site/src/components/server-claim-control-panel";
import { ServerReviewPanel } from "../site/src/components/server-review-panel";

type Element = ReactElement<Record<string, unknown>>;

function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  const type = element.type as
    | { displayName?: string }
    | (((props: unknown) => ReactNode) & { displayName?: string })
    | string;
  if (typeof type === "function" && type.displayName === "Button") {
    return [
      { ...element, type: "button" } as Element,
      ...descendants(element.props.children as ReactNode),
    ];
  }
  return [element, ...descendants(element.props.children as ReactNode)];
}

function guestAuthLinks(node: ReactNode) {
  return descendants(node).filter(
    (element) =>
      element.type === GuestAuthLinks ||
      (typeof element.type === "function" &&
        "displayName" in element.type &&
        element.type.displayName === "GuestAuthLinks"),
  );
}

function resetHarness() {
  harness.cursor = 0;
  harness.slots.length = 0;
  harness.fetch.mockReset();
}

beforeEach(resetHarness);

it("exposes guest login and register links on the server review panel", () => {
  const links = guestAuthLinks(
    ServerReviewPanel({
      serverId: "srv_demo",
      initialPage: { reviews: [], total: 0, page: 1, totalPages: 1 },
    }),
  );
  expect(links).toHaveLength(1);
  expect(links[0]?.props.loginHref).toBe("/auth/login?next=%2Fservers%2Fdemo-server");
  expect(links[0]?.props.registerHref).toBe("/auth/register?next=%2Fservers%2Fdemo-server");
  expect(links[0]?.props.createAccountLabel).toBe(getDictionary("en").workspace.createAccount);
});

it("exposes guest login and register links when claim control requires sign-in", () => {
  ServerClaimControlPanel({
    serverId: "srv_demo",
    serverName: "Demo Server",
    expectedActorId: null,
  });
  harness.slots[3] = true;
  harness.cursor = 0;
  const links = guestAuthLinks(
    ServerClaimControlPanel({
      serverId: "srv_demo",
      serverName: "Demo Server",
      expectedActorId: null,
    }),
  );
  expect(links).toHaveLength(1);
  expect(links[0]?.props.loginHref).toBe("/auth/login?next=%2Fservers%2Fdemo-server");
  expect(links[0]?.props.registerHref).toBe("/auth/register?next=%2Fservers%2Fdemo-server");
});
