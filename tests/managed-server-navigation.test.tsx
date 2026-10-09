import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ path: "/workspace/servers" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
import { Sidebar } from "../apps/web/src/components/sidebar";
it.each(["en", "ru"] as const)("exposes a localized managed-server destination in %s", (locale) => {
  state.path = "/workspace/servers";
  const html = renderToStaticMarkup(
    <Sidebar locale={locale} isCollapsed={false} onToggle={() => {}} />,
  );
  expect(html).toContain(locale === "ru" ? "Управляемые серверы" : "Managed servers");
  expect(html).toContain('href="/workspace/servers"');
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
