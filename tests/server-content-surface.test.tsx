import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { serverContentCopy } from "../site/src/lib/server-content-copy";
import { getUserPlatformCopy } from "../site/src/lib/user-platform-copy";

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
  usePathname: () => "/workspace/servers/srv/content",
}));

vi.mock("../site/src/lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
vi.mock("../site/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../site/src/lib/services/server-content-service", () => ({
  serverContentService: mocks,
}));

import Page, { generateMetadata } from "../site/src/app/workspace/servers/[id]/content/page";
import { ServerContentEditorPage } from "../site/src/components/server-content-editor-page";

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
  const guest = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "srv" }) }));
  expect(guest).toContain('href="/auth/login?next=%2Fworkspace%2Fservers%2Fsrv%2Fcontent"');
  expect(guest).toContain('href="/auth/register?next=%2Fworkspace%2Fservers%2Fsrv%2Fcontent"');
  expect(mocks.page).not.toHaveBeenCalled();
});

it("shows revoked authority and recovery without creating editor actions", async () => {
  mocks.page.mockRejectedValue(new AppError("private role details", 403, "FORBIDDEN"));
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "srv" }) }));
  expect(html).toContain('role="alert"');
  expect(html).toContain("overflow-x-clip");
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
  const empty = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "srv" }) }));
  expect(empty).toContain(getUserPlatformCopy("en").empty);
  expect(empty).toContain(serverContentCopy("en").emptyHint);
});
it("distinguishes an empty catalog from an empty filtered result", async () => {
  const copy = getUserPlatformCopy("en");
  const team = serverContentCopy("en");
  mocks.page.mockResolvedValue({ server, items: [], page: 1, hasMore: false });
  const filtered = renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ id: "srv" }),
      searchParams: Promise.resolve({ status: "draft", q: "Lua" }),
    }),
  );
  expect(filtered).toContain(copy.emptyFiltered);
  expect(filtered).toContain(team.emptyFilteredHint);
  expect(filtered).toContain('href="/workspace/servers/srv/content"');
  expect(filtered).toContain(copy.reset);
  expect(filtered).not.toContain(copy.empty);
});
