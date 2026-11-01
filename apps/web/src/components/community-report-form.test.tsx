import type { ReactElement, ReactNode } from "react";
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

vi.mock("next/navigation", () => ({ usePathname: () => "/articles/guide" }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { CommunityReportForm } from "./community-report-form";
import { communityReportCopy } from "../lib/community-report-copy";

type Element = ReactElement<Record<string, unknown>>;

function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...descendants(element.props.children as ReactNode)];
}

function renderGuestForm() {
  harness.cursor = 0;
  return descendants(
    CommunityReportForm({
      targetType: "comment",
      targetId: "comment",
      locale: "en",
      authenticated: false,
    }),
  );
}

beforeEach(() => {
  harness.slots = [];
  harness.slots[1] = true;
  harness.slots[8] = true;
  harness.slots[9] = true;
  harness.cursor = 0;
  harness.cleanups = [];
});

afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup?.();
});

it("seeds guest sign-in with the current pathname return target", () => {
  const signIn = renderGuestForm().find(
    (node) => node.props.href === "/auth/login?next=%2Farticles%2Fguide",
  );
  expect(signIn).toBeTruthy();
  expect(String(signIn?.props.children)).toContain(communityReportCopy("en").signIn);
});
