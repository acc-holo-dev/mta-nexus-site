vi.mock("server-only", () => ({}));

import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
  session: vi.fn(),
  states: vi.fn(),
  muteStates: vi.fn(),
  directory: vi.fn(),
  locale: "en" as "en" | "ru",
  ready: false,
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) =>
      actual.useState(initial === "" && mocks.ready ? "Reviewed reason" : initial),
  };
});
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/admin/community",
  notFound: () => {
    throw new Error("TEST_NOT_FOUND");
  },
}));
vi.mock("@nexus/db", () => ({
  followWorkspaceRepository: { states: mocks.states, muteStates: mocks.muteStates },
}));
vi.mock("@nexus/security", () => ({
  can: (actor: { role: string }) => ["moderator", "admin"].includes(actor.role),
}));
vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: async () => mocks.locale,
}));
vi.mock("../../src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../../src/lib/services/discovery-service", () => ({
  discoveryService: { stream: mocks.stream },
}));
vi.mock("../../src/lib/services/community-moderation-service", () => ({
  communityModerationService: { page: mocks.page, detail: mocks.detail },
}));
vi.mock("../../src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: { getDirectory: mocks.directory },
  indexMtaObservations: () => () => null,
  mtaLiveStatus: () => "unknown",
}));
vi.mock("../../src/components/locale-context", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: mocks.locale, dictionary: getDictionary(mocks.locale) }),
  };
});
vi.mock("../../src/features/resources/view", () => ({ ProductCard: () => null }));
vi.mock("../../src/components/article-card", () => ({ ArticleCard: () => null }));
vi.mock("../../src/components/follow-button", () => ({ FollowButton: () => null }));

import { generateMetadata as moderationMetadata } from "../../src/app/admin/community/page";
import StreamLoading from "../../src/app/discover/stream/loading";
import StreamPage, { generateMetadata as streamMetadata } from "../../src/app/discover/stream/page";
import { CommunityModerationScreen } from "../../src/features/community/server/community-moderation-screen";
import { ContentModerationControls } from "../../src/components/content-moderation-controls";
import { moderationCopy } from "../../src/lib/community-moderation-copy";
import { discoveryStreamCopy } from "../../src/lib/discovery-stream-copy";
import { getDictionary } from "../../src/lib/i18n";

const time = "2026-10-11T00:00:00.000Z",
  item = {
    id: "item",
    slug: "post",
    title: "Private draft",
    type: "post",
    status: "draft",
    excerpt: "Preview",
    createdAt: time,
    updatedAt: time,
    author: { username: "writer", name: "Writer", avatar: null },
  };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.ready = false;
  mocks.session.mockResolvedValue({ id: "actor", role: "moderator" });
  mocks.states.mockResolvedValue([]);
  mocks.muteStates.mockResolvedValue([]);
  mocks.directory.mockResolvedValue({ servers: [], isStale: false });
  mocks.stream.mockResolvedValue({
    type: "organizations",
    items: [
      {
        id: "team",
        name: "Public team",
        slug: "team",
        logoUrl: null,
        description: "Public description",
        isVerified: true,
      },
    ],
    page: 1,
    hasMore: true,
    nextCursor: "older",
    previousCursor: "newer",
  });
  mocks.page.mockResolvedValue({ items: [item], hasMore: true, nextCursor: "older" });
  mocks.detail.mockResolvedValue({
    item: {
      ...item,
      body: "Full draft <script>unsafe()</script>",
      truncated: false,
      tags: ["Lua"],
      organization: { name: "Public team", href: "/organizations/team" },
      server: null,
    },
    history: [
      {
        id: "event",
        action: "content.archived",
        createdAt: time,
        from: "published",
        to: "archived",
        notes: "Private staff reason",
      },
    ],
    hasMore: true,
    nextCursor: "older",
  });
});
it.each(["ru", "en"] as const)(
  "renders %s stream filters, continued navigation and reused identities",
  async (locale) => {
    mocks.locale = locale;
    const html = renderToStaticMarkup(
      await StreamPage({
        searchParams: Promise.resolve({ type: "organizations", q: "Team", verified: "1" }),
      }),
    );
    expect(html).toContain(discoveryStreamCopy(locale).title);
    expect(html).toContain("min-w-0");
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain('action="/discover/stream"');
    expect(html).toContain('name="type"');
    expect(html).not.toContain('name="sort"');
    expect(html).toContain("type=organizations&amp;q=Team&amp;verified=1&amp;cursor=older");
    expect(html).toContain('href="/organizations/team"');
    expect(mocks.states).toHaveBeenCalledTimes(1);
    expect(mocks.directory).not.toHaveBeenCalled();
    expect(await streamMetadata()).toMatchObject({
      title: discoveryStreamCopy(locale).title,
      alternates: { canonical: "/discover/stream" },
    });
  },
);
it("rejects repeated/incompatible SSR stream filters with ErrorState retry", async () => {
  const html = renderToStaticMarkup(
    await StreamPage({ searchParams: Promise.resolve({ type: ["servers", "resources"] }) }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(discoveryStreamCopy("en").invalid);
  expect(html).toContain(getDictionary("en").errors.retry);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("min-w-0");
  expect(mocks.stream).not.toHaveBeenCalled();
});
it("displays mismatched continuation as ErrorState with a matching retry recovery link", async () => {
  mocks.stream.mockRejectedValueOnce(new AppError("PRIVATE", 400, "INVALID_CURSOR"));
  const html = renderToStaticMarkup(
    await StreamPage({ searchParams: Promise.resolve({ type: "organizations", q: "Team" }) }),
  );
  expect(html).toContain(discoveryStreamCopy("en").invalid);
  expect(html).toContain('role="alert"');
  expect(html).toContain(getDictionary("en").errors.retry);
  expect(html).toContain('href="/discover/stream?type=organizations&amp;q=Team"');
  expect(html).toContain("overflow-x-clip");
  expect(html).not.toContain("PRIVATE");
});
it.each(["ru", "en"] as const)(
  "keeps the %s stream loading shell clipped without inventing results",
  async (locale) => {
    mocks.locale = locale;
    const copy = discoveryStreamCopy(locale);
    const html = renderToStaticMarkup(await StreamLoading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('id="discover-stream-loading-heading"');
    expect(html).toContain(`>${copy.title}<`);
    expect(html).toContain(copy.loading);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
  },
);
it.each(["ru", "en"] as const)(
  "renders private %s moderation queue/detail without public draft links or raw HTML",
  async (locale) => {
    mocks.locale = locale;
    const queue = renderToStaticMarkup(
      await CommunityModerationScreen({
        searchParams: Promise.resolve({ status: "draft", type: "post", author: "writer" }),
      }),
    );
    expect(queue).toContain(moderationCopy(locale).title);
    expect(queue).toContain(`<search aria-label="${moderationCopy(locale).search}"`);
    expect(queue).toContain('name="author"');
    expect(queue).toContain("bg-accent text-white");
    expect(queue).toContain('href="/admin/community/item"');
    expect(queue).toContain("type=post&amp;author=writer&amp;cursor=older");
    expect(queue).toContain("overflow-x-clip");
    const detail = renderToStaticMarkup(await CommunityModerationScreen({ id: "item" }));
    expect(detail).toContain("Full draft &lt;script&gt;");
    expect(detail).toContain("Private staff reason");
    expect(detail).not.toContain('href="/articles/post"');
    expect(detail).toContain('href="/users/writer"');
    expect(detail).toContain('href="/admin/community/item?cursor=older"');
    expect(detail).toContain("overflow-x-clip");
    expect(await moderationMetadata()).toMatchObject({ robots: { index: false, follow: false } });
  },
);
it("asks unsigned visitors to sign in without reading private moderation data", async () => {
  mocks.session.mockResolvedValueOnce(null);
  const html = renderToStaticMarkup(await CommunityModerationScreen({ id: "item" }));
  expect(html).toContain("/auth/login?next=");
  expect(html).not.toContain(moderationCopy("en").denied);
  expect(html).not.toContain("Private draft");
  expect(mocks.detail).not.toHaveBeenCalled();
});
it("denies signed-in non-staff without reading private moderation data", async () => {
  mocks.session.mockResolvedValueOnce({ id: "user", role: "user" });
  const html = renderToStaticMarkup(await CommunityModerationScreen({ id: "item" }));
  expect(html).toContain(moderationCopy("en").denied);
  expect(html).not.toContain("/auth/login");
  expect(html).not.toContain("Private draft");
  expect(mocks.detail).not.toHaveBeenCalled();
});
it("separates session failure from login and masks revoked-authority errors", async () => {
  mocks.session.mockRejectedValueOnce(new Error("PRIVATE_SESSION"));
  const auth = renderToStaticMarkup(await CommunityModerationScreen({ id: "item" }));
  expect(auth).toContain(moderationCopy("en").unavailable);
  expect(auth).toContain('role="alert"');
  expect(auth).toContain("overflow-x-clip");
  expect(auth).not.toContain('href="/auth/login"');
  mocks.detail.mockRejectedValueOnce(new AppError("PRIVATE", 403, "FORBIDDEN"));
  const denied = renderToStaticMarkup(await CommunityModerationScreen({ id: "item" }));
  expect(denied).toContain(moderationCopy("en").denied);
  expect(denied).toContain('role="alert"');
  expect(denied).toContain("overflow-x-clip");
  expect(denied).not.toContain("Private draft");
});
it("rejects duplicate detail filters and preserves missing-target 404", async () => {
  const html = renderToStaticMarkup(
    await CommunityModerationScreen({
      id: "item",
      searchParams: Promise.resolve({ cursor: ["bad", "other"] }),
    }),
  );
  expect(html).toContain(moderationCopy("en").invalid);
  expect(html).toContain('role="alert"');
  expect(html).toContain("overflow-x-clip");
  expect(mocks.detail).not.toHaveBeenCalled();
  mocks.detail.mockRejectedValueOnce(new AppError("Missing", 404, "NOT_FOUND"));
  await expect(CommunityModerationScreen({ id: "item" })).rejects.toThrow("TEST_NOT_FOUND");
});
it("renders an empty moderation queue with clear-filters recovery", async () => {
  mocks.page.mockResolvedValueOnce({ items: [], hasMore: false, nextCursor: null });
  const html = renderToStaticMarkup(
    await CommunityModerationScreen({
      searchParams: Promise.resolve({ status: "draft", type: "post", q: "alpha" }),
    }),
  );
  expect(html).toContain(moderationCopy("en").empty);
  expect(html).toContain(moderationCopy("en").reset);
  expect(html).toContain('href="/admin/community"');
  expect(html).toContain("overflow-x-clip");
});
it("enables both existing moderation actions when a valid review note is entered", () => {
  mocks.ready = true;
  const html = renderToStaticMarkup(
    <ContentModerationControls contentId="item" expectedUpdatedAt={time} />,
  );
  expect(html).toContain("Reviewed reason");
  expect(html).not.toContain('disabled=""');
  expect(html).toContain(`>${getDictionary("en").admin.publish}<`);
});
it.each([
  { status: "published", truncated: false },
  { status: "draft", truncated: true },
])("disables unavailable publication commands but retains archive for %j", (props) => {
  mocks.ready = true;
  const html = renderToStaticMarkup(
    <ContentModerationControls contentId="item" expectedUpdatedAt={time} workspace {...props} />,
  );
  expect((html.match(/disabled=""/gu) ?? []).length).toBe(1);
});
it("shows legacy truncation explicitly and retains a bounded review surface", async () => {
  mocks.detail.mockResolvedValueOnce({
    item: {
      ...item,
      body: "Legacy preview",
      truncated: true,
      tags: [],
      organization: null,
      server: null,
    },
    history: [],
    hasMore: false,
    nextCursor: null,
  });
  const html = renderToStaticMarkup(await CommunityModerationScreen({ id: "item" }));
  expect(html).toContain(moderationCopy("en").large);
  expect(html).toContain(`role="note" class="text-sm text-muted">${moderationCopy("en").large}`);
  expect(html).toContain(moderationCopy("en").noHistory);
  expect(html).toContain("overflow-x-clip");
});
