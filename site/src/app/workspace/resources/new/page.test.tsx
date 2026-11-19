import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getUserPlatformCopy } from "../../../../features/community/user-platform-copy";
import { getDictionary } from "../../../../lib/i18n";
import { authService } from "../../../../lib/services/accounts/auth-service";

const mocks = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  actor: { id: "author" } as { id: string } | null,
  forms: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/resources/new",
}));
vi.mock("../../../../lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => mocks.actor },
}));
vi.mock("../../../../lib/i18n/server", () => ({
  getRequestLocale: async () => mocks.locale,
}));
vi.mock("../../../../features/resources/create-controls", () => ({
  NewResourceForm: (props: unknown) => {
    mocks.forms(props);
    return null;
  },
}));

import Page, { generateMetadata } from "./page";

beforeEach(() => {
  mocks.actor = { id: "author" };
  mocks.forms.mockClear();
});
it("passes authenticated actor identity to the publishing form and disables indexing", async () => {
  renderToStaticMarkup(await Page());
  expect(mocks.forms).toHaveBeenCalledWith({ actorId: "author" });
  expect((await generateMetadata()).robots).toMatchObject({ index: false, follow: false });
});
it.each(["en", "ru"] as const)("requires sign-in before showing the form in %s", async (locale) => {
  mocks.actor = null;
  mocks.locale = locale;
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain(getDictionary(locale).workspace.signInRequired);
  expect(html).toContain('href="/auth/login?next=%2Fworkspace%2Fresources%2Fnew"');
  expect(html).toContain('href="/auth/register?next=%2Fworkspace%2Fresources%2Fnew"');
  expect(mocks.forms).not.toHaveBeenCalled();
});
it.each(["en", "ru"] as const)(
  "offers a retry when publishing session lookup fails in %s",
  async (locale) => {
    mocks.locale = locale;
    vi.spyOn(authService, "getSession").mockRejectedValueOnce(new Error("PRIVATE_SESSION"));
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain(`>${getDictionary(locale).publishing.resourceTitle}</h1>`);
    expect(html).toContain(getUserPlatformCopy(locale).unavailable);
    expect(html).toContain(getDictionary(locale).errors.retry);
    expect(html).toContain('href="/workspace/resources/new"');
    expect(html).not.toContain("/auth/login");
    expect(html).not.toContain("PRIVATE_SESSION");
    expect(mocks.forms).not.toHaveBeenCalled();
  },
);
