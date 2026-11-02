import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as Array<undefined | (() => void)>,
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
  useRef: (initial: unknown) => ({ current: initial }),
  useCallback: (callback: unknown) => callback,
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/support" }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("./locale-context", async () => {
  const { getDictionary } = await import("../lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { getDictionary } from "../lib/i18n";
import { PlatformSignIn } from "./platform-sign-in";
import { SupportCenter } from "./support-center";

beforeEach(() => {
  harness.slots = [[], 1, 1, false, false, null, true];
  harness.slots[14] = true;
  harness.slots[15] = true;
  harness.slots[16] = true;
  harness.cursor = 0;
  harness.cleanups = [];
});

afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup?.();
});

it("seeds guest sign-in with the current pathname return target", () => {
  harness.cursor = 0;
  const gate = SupportCenter({}) as ReactElement<{
    locale: "en";
    returnPath?: string | null;
  }>;
  expect(gate.type).toBe(PlatformSignIn);
  expect(gate.props.returnPath).toBeUndefined();
  const html = renderToStaticMarkup(createElement(gate.type, gate.props));
  expect(html).toContain('href="/auth/login?next=%2Fsupport"');
  expect(html).toContain('href="/auth/register?next=%2Fsupport"');
  expect(html).toContain(getDictionary("en").workspace.signInRequired);
  expect(html).toContain(getDictionary("en").workspace.signIn);
});
