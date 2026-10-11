import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppError } from "@nexus/domain";
import { serverContentCopy } from "../apps/web/src/lib/server-content-copy";
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
vi.mock("../apps/web/src/lib/services/server-content-service", () => ({
  serverContentService: mocks,
}));
import Page, { generateMetadata } from "../apps/web/src/app/workspace/servers/[id]/content/page";
import { ServerContentEditorPage } from "../apps/web/src/components/server-content-editor-page";
const server = { id: "srv", name: "Team", slug: "team" };
const content = {
  id: "content",
  slug: "article",
  title: "Other author draft",
  type: "article",
  status: "draft",
  authorId: "original",
  serverId: "srv",
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
  mocks.page.mockResolvedValue({ server, items: [content], page: 2, hasMore: true });
  mocks.get.mockResolvedValue({ server, content });
  mocks.context.mockResolvedValue(server);
});
it.each(["en", "ru"] as const)(
  "renders all-author management, filters and scope-preserving navigation in %s",
  async (locale) => {
    mocks.locale = locale;
    const html = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ id: "srv" }),
        searchParams: Promise.resolve({ page: "2", status: "draft", q: "Lua" }),
      }),
    );
    expect(html).toContain(serverContentCopy(locale).title);
    expect(html).toContain("Other author draft");
    expect(html).toContain("Original author");
    expect(html).toContain('href="/workspace/servers/srv/content/new"');
    expect(html).toContain('href="/workspace/servers/srv/content/content"');
    expect(html).toContain("status=draft");
    expect(html).toContain("q=Lua");
    expect(html).toContain("page=3");
    expect(await generateMetadata()).toMatchObject({ robots: { index: false, follow: false } });
  },
);
it("does not load private server data without a session", async () => {
  mocks.session.mockResolvedValue(null);
  expect(renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "srv" }) }))).toContain(
    'href="/auth/login"',
  );
  expect(mocks.page).not.toHaveBeenCalled();
});
it("shows revoked authority and recovery without creating editor actions", async () => {
  mocks.page.mockRejectedValue(new AppError("private role details", 403, "FORBIDDEN"));
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "srv" }) }));
  expect(html).toContain('role="alert"');
  expect(html).toContain(getUserPlatformCopy("en").retry);
  expect(html).not.toContain("private role");
  expect(html).not.toContain("/content/new");
});
it("uses the shared author editor in the server context without exposing immutable scope controls", async () => {
  const html = renderToStaticMarkup(
    await ServerContentEditorPage({ id: "srv", contentId: "content" }),
  );
  expect(html).toContain(serverContentCopy("en").context);
  expect(html).toContain("Team");
  expect(html).toContain("Other author draft");
  expect(html).not.toContain('name="serverId"');
  expect(html).not.toContain('name="authorId"');
  expect(html).toContain(getUserPlatformCopy("en").reviewNote);
});
it("loads only server context when opening a new publication and handles empty lists", async () => {
  expect(renderToStaticMarkup(await ServerContentEditorPage({ id: "srv" }))).toContain(
    'name="slug"',
  );
  expect(mocks.context).toHaveBeenCalledWith("srv", { id: "actor", role: "user" });
  expect(mocks.page).not.toHaveBeenCalled();
  mocks.page.mockResolvedValue({ server, items: [], page: 1, hasMore: false });
  expect(renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "srv" }) }))).toContain(
    getUserPlatformCopy("en").empty,
  );
});
