import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@nexus/domain";
const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
  session: vi.fn(),
  states: vi.fn(),
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
  notFound: () => {
    throw new Error("TEST_NOT_FOUND");
  },
}));
vi.mock("@nexus/db", () => ({ followWorkspaceRepository: { states: mocks.states } }));
vi.mock("@nexus/security", () => ({
  can: (actor: { role: string }) => ["moderator", "admin"].includes(actor.role),
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../apps/web/src/lib/services/discovery-service", () => ({
  discoveryService: { stream: mocks.stream },
}));
vi.mock("../apps/web/src/lib/services/community-moderation-service", () => ({
  communityModerationService: { page: mocks.page, detail: mocks.detail },
}));
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: { getDirectory: mocks.directory },
  indexMtaObservations: () => () => null,
  mtaLiveStatus: () => "unknown",
}));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: mocks.locale, dictionary: getDictionary(mocks.locale) }),
  };
});
vi.mock("../apps/web/src/components/product-card", () => ({ ProductCard: () => null }));
vi.mock("../apps/web/src/components/article-card", () => ({ ArticleCard: () => null }));
vi.mock("../apps/web/src/components/follow-button", () => ({ FollowButton: () => null }));
import StreamPage, {
  generateMetadata as streamMetadata,
} from "../apps/web/src/app/discover/stream/page";
import { generateMetadata as moderationMetadata } from "../apps/web/src/app/admin/community/page";
import { CommunityModerationScreen } from "../apps/web/src/components/community-moderation-screen";
import { ContentModerationControls } from "../apps/web/src/components/content-moderation-controls";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { moderationCopy } from "../apps/web/src/lib/community-moderation-copy";
import { discoveryStreamCopy } from "../apps/web/src/lib/discovery-stream-copy";
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
it("rejects repeated/incompatible SSR stream filters without selecting a different catalog", async () => {
  const html = renderToStaticMarkup(
    await StreamPage({ searchParams: Promise.resolve({ type: ["servers", "resources"] }) }),
  );
  expect(html).toContain('role="alert"');
  expect(mocks.stream).not.toHaveBeenCalled();
});
it("displays mismatched continuation as an error with a matching latest-results recovery link", async () => {
  mocks.stream.mockRejectedValueOnce(new AppError("PRIVATE", 400, "INVALID_CURSOR"));
  const html = renderToStaticMarkup(
    await StreamPage({ searchParams: Promise.resolve({ type: "organizations", q: "Team" }) }),
  );
  expect(html).toContain(discoveryStreamCopy("en").invalid);
  expect(html).toContain('href="/discover/stream?type=organizations&amp;q=Team"');
  expect(html).not.toContain("PRIVATE");
});
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
    expect(queue).toContain('name="author"');
    expect(queue).toContain("bg-accent text-white");
    expect(queue).toContain('href="/admin/community/item"');
    expect(queue).toContain("type=post&amp;author=writer&amp;cursor=older");
    const detail = renderToStaticMarkup(await CommunityModerationScreen({ id: "item" }));
    expect(detail).toContain("Full draft &lt;script&gt;");
    expect(detail).toContain("Private staff reason");
    expect(detail).not.toContain('href="/articles/post"');
    expect(detail).toContain('href="/users/writer"');
    expect(detail).toContain('href="/admin/community/item?cursor=older"');
    expect(await moderationMetadata()).toMatchObject({ robots: { index: false, follow: false } });
  },
);
it.each([null, { id: "user", role: "user" }])(
  "does not read private moderation data without staff %j",
  async (actor) => {
    mocks.session.mockResolvedValueOnce(actor);
    const html = renderToStaticMarkup(await CommunityModerationScreen({ id: "item" }));
    expect(html).toContain(moderationCopy("en").denied);
    expect(html).not.toContain("Private draft");
    expect(mocks.detail).not.toHaveBeenCalled();
  },
);
it("separates session failure from login and masks revoked-authority errors", async () => {
  mocks.session.mockRejectedValueOnce(new Error("PRIVATE_SESSION"));
  const auth = renderToStaticMarkup(await CommunityModerationScreen({ id: "item" }));
  expect(auth).toContain(moderationCopy("en").unavailable);
  expect(auth).not.toContain('href="/auth/login"');
  mocks.detail.mockRejectedValueOnce(new AppError("PRIVATE", 403, "FORBIDDEN"));
  const denied = renderToStaticMarkup(await CommunityModerationScreen({ id: "item" }));
  expect(denied).toContain(moderationCopy("en").denied);
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
  expect(mocks.detail).not.toHaveBeenCalled();
  mocks.detail.mockRejectedValueOnce(new AppError("Missing", 404, "NOT_FOUND"));
  await expect(CommunityModerationScreen({ id: "item" })).rejects.toThrow("TEST_NOT_FOUND");
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
  expect(html).toContain(moderationCopy("en").noHistory);
});
