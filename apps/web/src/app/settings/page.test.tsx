import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlatformSignIn } from "../../components/content-catalog-controls";
import { getDictionary } from "../../lib/i18n";

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
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("../../components/locale-context", async () => {
  const { getDictionary } = await import("../../lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});
vi.mock("../../components/context-switcher", () => ({ ContextSwitcher: () => null }));
vi.mock("../../components/private-change-history-controls", () => ({
  ProfileChangeHistoryLink: () => null,
}));
vi.mock("../../components/public-profile-form", () => ({ PublicProfileForm: () => null }));
vi.mock("../../components/web-push-settings", () => ({ WebPushSettings: () => null }));

import SettingsPage from "./page";

beforeEach(() => {
  harness.slots = [
    null,
    null,
    false,
    true,
    false,
    0,
    null,
    false,
    { currentPassword: "", newPassword: "" },
    null,
    "",
  ];
  harness.slots[12] = true;
  harness.slots[13] = true;
  harness.cursor = 0;
  harness.cleanups = [];
});

afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup?.();
});

it("seeds signed-out sign-in with the current pathname return target", () => {
  harness.cursor = 0;
  const gate = SettingsPage() as ReactElement<{ locale: string; returnPath?: string | null }>;
  expect(gate.type).toBe(PlatformSignIn);
  expect(gate.props.returnPath).toBe("/settings");
  const html = renderToStaticMarkup(gate);
  const copy = getDictionary("en").workspace;
  expect(html).toContain('href="/auth/login?next=%2Fsettings"');
  expect(html).toContain(copy.signInRequired);
  expect(html).toContain(copy.signIn);
});
