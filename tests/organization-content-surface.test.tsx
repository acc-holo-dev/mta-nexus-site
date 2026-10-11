import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppError } from "@nexus/domain";
import { organizationContentCopy } from "../apps/web/src/lib/organization-content-copy";
import { getUserPlatformCopy } from "../apps/web/src/lib/user-platform-copy";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  page: vi.fn(),
  get: vi.fn(),
  context: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => undefined, refresh: () => undefined }),
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../apps/web/src/lib/services/organization-content-service", () => ({
  organizationContentService: mocks,
}));
import Page, {
  generateMetadata,
} from "../apps/web/src/app/workspace/organizations/[id]/content/page";
import { OrganizationContentEditorPage } from "../apps/web/src/components/organization-content-editor-page";
const organization = { id: "org", name: "Team", slug: "team" };
const content = {
  id: "content",
  slug: "article",
  title: "Other author draft",
  type: "article",
  status: "draft",
  authorId: "original",
  organizationId: "org",
  body: "Body of another author's publication.",
  tags: [],
  excerpt: "Summary",
  coverImageUrl: "",
  updatedAt: "2026-10-11T00:00:00.000Z",
  commentCount: 2,
  authorName: "Original author",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.session.mockResolvedValue({ id: "actor", role: "user" });
  mocks.page.mockResolvedValue({ organization, items: [content], page: 2, hasMore: true });
  mocks.get.mockResolvedValue({ organization, content });
  mocks.context.mockResolvedValue(organization);
});
it.each(["en", "ru"] as const)(
  "renders all-author management, filters and scope-preserving navigation in %s",
  async (locale) => {
    mocks.locale = locale;
    const html = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ id: "org" }),
        searchParams: Promise.resolve({ page: "2", status: "draft", q: "Lua" }),
      }),
    );
    expect(html).toContain(organizationContentCopy(locale).title);
    expect(html).toContain("Other author draft");
    expect(html).toContain("Original author");
    expect(html).toContain('href="/workspace/organizations/org/content/new"');
    expect(html).toContain('href="/workspace/organizations/org/content/content"');
    expect(html).toContain("status=draft");
    expect(html).toContain("q=Lua");
    expect(html).toContain("page=3");
    expect(await generateMetadata()).toMatchObject({ robots: { index: false, follow: false } });
  },
);
it("does not load private organization data without a session", async () => {
  mocks.session.mockResolvedValue(null);
  expect(renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "org" }) }))).toContain(
    'href="/auth/login"',
  );
  expect(mocks.page).not.toHaveBeenCalled();
});
it("shows revoked authority and recovery without creating editor actions", async () => {
  mocks.page.mockRejectedValue(new AppError("private role details", 403, "FORBIDDEN"));
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "org" }) }));
  expect(html).toContain('role="alert"');
  expect(html).toContain(getUserPlatformCopy("en").retry);
  expect(html).not.toContain("private role");
  expect(html).not.toContain("/content/new");
});
it("uses the shared author editor in the organization context without exposing immutable scope controls", async () => {
  const html = renderToStaticMarkup(
    await OrganizationContentEditorPage({ id: "org", contentId: "content" }),
  );
  expect(html).toContain(organizationContentCopy("en").context);
  expect(html).toContain("Team");
  expect(html).toContain("Other author draft");
  expect(html).not.toContain('name="organizationId"');
  expect(html).not.toContain('name="authorId"');
  expect(html).toContain(getUserPlatformCopy("en").reviewNote);
});
it("loads only organization context when opening a new publication and handles empty lists", async () => {
  expect(renderToStaticMarkup(await OrganizationContentEditorPage({ id: "org" }))).toContain(
    'name="slug"',
  );
  expect(mocks.context).toHaveBeenCalledWith("org", { id: "actor", role: "user" });
  expect(mocks.page).not.toHaveBeenCalled();
  mocks.page.mockResolvedValue({ organization, items: [], page: 1, hasMore: false });
  expect(renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "org" }) }))).toContain(
    getUserPlatformCopy("en").empty,
  );
});
