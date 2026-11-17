import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../../../lib/i18n";
import { platformReportCopy } from "../../moderation/platform-report-i18n";
import type { ShellAuthSession } from "../session";

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
vi.mock("../auth-session", () => ({ useAuthSession: () => state.session }));

import { FooterContribute } from "./footer-contribute";
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

function shellHrefs(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*href="([^"]+)"/gu)]
    .map((match) => match[1])
    .filter((href): href is string => !!href && href !== "/dev" && !href.startsWith("/auth/"))
    .sort();
}

describe("desktop and mobile destination parity", () => {
  it.each(["en", "ru"] as const)("offers the same member destinations in %s", (locale) => {
    state.session = { status: "authenticated", user: { username: "member", role: "user" } };
    const mobile = renderToStaticMarkup(<MobileNav locale={locale} />);
    const desktop = renderToStaticMarkup(
      <Sidebar locale={locale} isCollapsed={false} onToggle={() => {}} />,
    );
    expect(shellHrefs(mobile)).toEqual(shellHrefs(desktop));
  });

  it.each(["anonymous", "loading"] as const)(
    "matches public destinations for %s sessions",
    (status) => {
      state.session = { status, user: null };
      const mobile = renderToStaticMarkup(<MobileNav locale="en" />);
      const desktop = renderToStaticMarkup(
        <Sidebar locale="en" isCollapsed={false} onToggle={() => {}} />,
      );
      expect(shellHrefs(mobile)).toEqual(shellHrefs(desktop));
      expect(shellHrefs(mobile)).not.toContain("/workspace/library");
      expect(shellHrefs(mobile)).not.toContain("/admin");
    },
  );

  it.each(["user", "moderator", "admin"])(
    "shows staff navigation consistently for role %s",
    (role) => {
      state.session = { status: "authenticated", user: { username: "member", role } };
      const mobile = renderToStaticMarkup(<MobileNav locale="en" />);
      const desktop = renderToStaticMarkup(
        <Sidebar locale="en" isCollapsed={false} onToggle={() => {}} />,
      );
      expect(shellHrefs(mobile)).toEqual(shellHrefs(desktop));
      expect(shellHrefs(mobile).includes("/admin")).toBe(role !== "user");
    },
  );
});

it.each(["en", "ru"] as const)(
  "keeps unavailable session distinct from guest navigation in %s",
  (locale) => {
    state.session = { status: "unavailable", user: null, retry: vi.fn() };
    const mobile = renderToStaticMarkup(<MobileNav locale={locale} />);
    const desktop = renderToStaticMarkup(
      <Sidebar locale={locale} isCollapsed={false} onToggle={() => {}} />,
    );
    const footer = renderToStaticMarkup(<FooterContribute locale={locale} />);
    const collapsed = renderToStaticMarkup(
      <Sidebar locale={locale} isCollapsed onToggle={() => {}} />,
    );
    for (const html of [mobile, desktop, footer, collapsed]) {
      expect(html).toContain(getDictionary(locale).accountControls.checkError);
      expect(html).toContain(getDictionary(locale).accountControls.retry);
      expect(html).not.toContain('href="/auth/login');
      expect(html).not.toContain('href="/workspace/library"');
      expect(html).not.toContain('href="/admin"');
    }
  },
);
