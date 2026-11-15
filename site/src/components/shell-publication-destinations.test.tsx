import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { platformReportCopy } from "../lib/platform-report-i18n";
import type { ShellAuthSession } from "./shell-destination-policy";

const state = vi.hoisted(() => ({
  session: { status: "anonymous", user: null } as ShellAuthSession,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const [value, setValue] = actual.useState(initial);
      return [initial === false ? true : value, setValue];
    },
  };
});
vi.mock("next/navigation", () => ({ usePathname: () => "/workspace/platform-reports" }));
vi.mock("./use-auth-session", () => ({ useAuthSession: () => state.session }));

import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";

describe("member report navigation", () => {
  beforeEach(() => {
    state.session = { status: "authenticated", user: { username: "member", role: "user" } };
  });

  it.each(["ru", "en"] as const)(
    "exposes the localized report link on desktop and mobile in %s",
    (locale) => {
      const mobile = renderToStaticMarkup(<MobileNav locale={locale} />);
      const desktop = renderToStaticMarkup(
        <Sidebar locale={locale} isCollapsed={false} onToggle={() => {}} />,
      );
      for (const html of [mobile, desktop]) {
        expect(html).toContain('href="/workspace/platform-reports"');
        expect(html).toContain(platformReportCopy(locale).myReports);
        const link = html.match(/<a\b[^>]*href="\/workspace\/platform-reports"[^>]*>/u)?.[0];
        expect(link).toContain('aria-current="page"');
      }
    },
  );

  it.each(["anonymous", "loading"] as const)("hides report tools from the %s session", (status) => {
    state.session = { status, user: null };
    const mobile = renderToStaticMarkup(<MobileNav locale="en" />);
    const desktop = renderToStaticMarkup(
      <Sidebar locale="en" isCollapsed={false} onToggle={() => {}} />,
    );
    expect(mobile).not.toContain('href="/workspace/platform-reports"');
    expect(desktop).not.toContain('href="/workspace/platform-reports"');
  });
});
