import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  actor: { id: "author" } as { id: string } | null,
  locale: "en" as "en" | "ru",
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../../../../lib/services/auth-service", () => ({
  authService: { getSession: async () => mocks.actor },
}));
vi.mock("../../../../lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
vi.mock("../../../../components/resource-publisher-workspace-nav", () => ({
  ResourcePublisherWorkspaceNav: () => <nav data-testid="resource-publisher-workspace-nav" />,
}));

import ResourcePublisherLayout from "./layout";

const params = Promise.resolve({ id: "prd_a" });

beforeEach(() => {
  mocks.actor = { id: "author" };
  mocks.locale = "en";
});

it("omits publisher workspace navigation for guests", async () => {
  mocks.actor = null;

  const html = renderToStaticMarkup(
    await ResourcePublisherLayout({
      params,
      children: <p>Sign-in gate</p>,
    }),
  );

  expect(html).not.toContain('data-testid="resource-publisher-workspace-nav"');
  expect(html).toContain("Sign-in gate");
});

it("renders publisher workspace navigation for signed-in authors", async () => {
  const html = renderToStaticMarkup(
    await ResourcePublisherLayout({
      params,
      children: <p>Publisher content</p>,
    }),
  );

  expect(html).toContain('data-testid="resource-publisher-workspace-nav"');
  expect(html).toContain("Publisher content");
});
