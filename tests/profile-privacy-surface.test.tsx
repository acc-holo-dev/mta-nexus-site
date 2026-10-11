import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@nexus/domain";
import { profilePrivacyCopy } from "../apps/web/src/lib/profile-privacy-copy";
const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  session: vi.fn(),
  own: vi.fn(),
  resolve: vi.fn(),
  page: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../apps/web/src/lib/services/profile-privacy-service", () => ({
  profilePrivacyService: { own: state.own },
}));
vi.mock("../apps/web/src/lib/services/publication-feed-service", () => ({
  publicationFeedService: { resolve: state.resolve, page: state.page },
}));
import PrivacyPage, { generateMetadata } from "../apps/web/src/app/settings/privacy/page";
import UserActivity, {
  generateMetadata as activityMetadata,
} from "../apps/web/src/app/users/[username]/activity/page";
const saved = {
  id: "actor",
  username: "member",
  showActivity: false,
  showProfessionalContacts: false,
  updatedAt: "2026-10-10T00:00:00.000Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  state.locale = "en";
  state.session.mockResolvedValue({ id: "actor", role: "developer" });
  state.own.mockResolvedValue(saved);
});
it.each(["en", "ru"] as const)(
  "renders saved choices, scope, recovery controls and private metadata in %s",
  async (locale) => {
    state.locale = locale;
    const copy = profilePrivacyCopy(locale);
    const html = renderToStaticMarkup(await PrivacyPage());
    expect(html).toContain(copy.title);
    expect(html).toContain(copy.scope);
    expect(html).toContain(copy.reloadHint.replaceAll("'", "&#x27;"));
    expect(html).toContain('name="showActivity"');
    expect(html).toContain('name="showProfessionalContacts"');
    expect(html).not.toContain('checked=""');
    expect(html).toContain('aria-describedby="privacy-contacts-description"');
    expect(html).toContain('href="/users/member"');
    expect(html).toContain('href="/settings/developer"');
    expect(await generateMetadata()).toEqual({
      title: copy.title,
      robots: { index: false, follow: false },
    });
  },
);
it("offers sign in without fetching private preferences for an anonymous visitor", async () => {
  state.session.mockResolvedValue(null);
  expect(renderToStaticMarkup(await PrivacyPage())).toContain('href="/auth/login"');
  expect(state.own).not.toHaveBeenCalled();
});
it("lets ordinary users edit privacy without advertising role-restricted developer editing", async () => {
  state.session.mockResolvedValue({ id: "actor", role: "user" });
  const html = renderToStaticMarkup(await PrivacyPage());
  expect(html).toContain(profilePrivacyCopy("en").save);
  expect(html).not.toContain('href="/settings/developer"');
});
it("keeps save disabled and offers saved-state recovery after a private load failure", async () => {
  state.own.mockRejectedValue(new Error("private SQL"));
  const html = renderToStaticMarkup(await PrivacyPage());
  expect(html).toContain('role="alert"');
  expect(html).toContain(profilePrivacyCopy("en").unavailable);
  expect(html).toMatch(/<fieldset disabled=""/u);
  expect(html).toContain(profilePrivacyCopy("en").reload);
  expect(html).not.toContain("private SQL");
});
it("returns not found for hidden personal activity without requesting publication data or exposing indexable metadata", async () => {
  state.resolve.mockRejectedValue(new AppError("Hidden or missing profile", 404, "NOT_FOUND"));
  await expect(UserActivity({ params: Promise.resolve({ username: "hidden" }) })).rejects.toThrow(
    "NOT_FOUND",
  );
  expect(state.page).not.toHaveBeenCalled();
  expect(await activityMetadata()).toMatchObject({ robots: { index: false, follow: false } });
});
