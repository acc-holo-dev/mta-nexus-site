import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as Array<undefined | (() => void)>,
  fetch: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
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
  useEffect: (effect: () => undefined | (() => void)) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) {
      harness.slots[index] = true;
      harness.cleanups.push(effect());
    }
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/workspace" }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { AccountControls } from "../apps/web/src/components/account-controls";
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
  return descendants(AccountControls());
}
beforeEach(() => {
  // account, checking, signingOut, error, attempt, session effect, focus effect
  harness.slots = [{ username: "alice" }, false, false, null, 0, true, true];
  harness.cursor = 0;
  harness.cleanups = [];
  harness.fetch.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
});
afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup?.();
  vi.unstubAllGlobals();
});
it("renders signed-in sign-out control on shared Button chrome", () => {
  const copy = getDictionary("en").accountControls;
  const nodes = render();
  const control = nodes.find(
    (node) => node.type === "button" && node.props["aria-label"] === copy.signOut,
  );
  expect(control).toBeTruthy();
  expect(String(control?.props.className)).toContain("rounded-md");
  expect(String(control?.props.className)).toContain("bg-elevated");
  expect(String(control?.props.className)).toContain("border-base");
});
