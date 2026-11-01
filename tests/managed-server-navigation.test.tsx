import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { ShellAuthSession } from "../apps/web/src/components/shell-destination-policy";

const state = vi.hoisted(() => ({
  path: "/workspace/servers",
  session: {
    status: "authenticated",
    user: { username: "owner", role: "user" },
  } as ShellAuthSession,
}));

vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("../apps/web/src/components/use-auth-session", () => ({
  useAuthSession: () => state.session,
}));

import { Sidebar } from "../apps/web/src/components/sidebar";
import {
  isStaffRole,
  showAdminDestination,
  showWorkspaceTools,
} from "../apps/web/src/components/shell-destination-policy";

beforeEach(() => {
  state.path = "/workspace/servers";
  state.session = {
    status: "authenticated",
    user: { username: "owner", role: "user" },
  };
});

it.each(["en", "ru"] as const)("exposes a localized managed-server destination in %s", (locale) => {
  state.path = "/workspace/servers";
  const html = renderToStaticMarkup(
    <Sidebar locale={locale} isCollapsed={false} onToggle={() => {}} />,
  );
  expect(html).toContain(locale === "ru" ? "Управляемые серверы" : "Managed servers");
  expect(html).toContain('href="/workspace/servers"');
  expect(html).not.toContain('href="/admin"');
});

it("hides managed-server tools for guests and keeps a sign-in CTA", () => {
  state.session = { status: "anonymous", user: null };
  const html = renderToStaticMarkup(
    <Sidebar locale="en" isCollapsed={false} onToggle={() => {}} />,
  );
  expect(html).not.toContain('href="/workspace/servers"');
  expect(html).toContain('href="/auth/login?next=%2Fworkspace%2Fservers"');
  expect(html).toContain("Sign in");
});

it.each([
  ["/workspace/servers", "/workspace/servers"],
  ["/workspace/servers/srv_1", "/workspace/servers"],
  ["/workspace/servers/new", "/workspace/servers/new"],
  ["/workspace", "/workspace"],
])("marks one current workspace destination on %s", (path, expected) => {
  state.path = path;
  const html = renderToStaticMarkup(<Sidebar locale="en" isCollapsed onToggle={() => {}} />);
  const active = html.match(/<a\b[^>]*aria-current="page"[^>]*>/g) ?? [];
  expect(active).toHaveLength(1);
  expect(active[0]).toContain(`href="${expected}"`);
});

it("applies UX-23 A staff/guest destination policy without inventing roles", () => {
  expect(isStaffRole("admin")).toBe(true);
  expect(isStaffRole("moderator")).toBe(true);
  expect(isStaffRole("user")).toBe(false);
  expect(showWorkspaceTools({ status: "loading", user: null })).toBe(false);
  expect(showWorkspaceTools({ status: "anonymous", user: null })).toBe(false);
  expect(
    showAdminDestination({
      status: "authenticated",
      user: { username: "a", role: "user" },
    }),
  ).toBe(false);
  expect(
    showAdminDestination({
      status: "authenticated",
      user: { username: "a", role: "admin" },
    }),
  ).toBe(true);
});
