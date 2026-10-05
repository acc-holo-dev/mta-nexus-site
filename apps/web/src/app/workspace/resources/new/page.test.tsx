import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getDictionary } from "../../../../lib/i18n";

const mocks = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  actor: { id: "author" } as { id: string } | null,
  forms: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../../../../lib/services/auth-service", () => ({
  authService: { getSession: async () => mocks.actor },
}));
vi.mock("../../../../lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
vi.mock("../../../../components/new-resource-form", () => ({
  NewResourceForm: (props: unknown) => {
    mocks.forms(props);
    return null;
  },
}));

import Page, { metadata } from "./page";

beforeEach(() => {
  mocks.actor = { id: "author" };
  mocks.forms.mockClear();
});
it("passes authenticated actor identity to the publishing form and disables indexing", async () => {
  renderToStaticMarkup(await Page());
  expect(mocks.forms).toHaveBeenCalledWith({ actorId: "author" });
  expect(metadata.robots).toMatchObject({ index: false, follow: false });
});
it.each(["en", "ru"] as const)("requires sign-in before showing the form in %s", async (locale) => {
  mocks.actor = null;
  mocks.locale = locale;
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain(getDictionary(locale).workspace.signInRequired);
  expect(html).toContain('href="/auth/login"');
  expect(mocks.forms).not.toHaveBeenCalled();
});
