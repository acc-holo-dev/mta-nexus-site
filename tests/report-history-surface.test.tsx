import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  locale: "en" as "ru" | "en",
  session: vi.fn(),
  discussionReports: vi.fn(),
  history: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw Error("NOT_FOUND_BOUNDARY");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../apps/web/src/lib/services/community-moderation-service", () => ({
  communityModerationService: state,
}));
vi.mock("../apps/web/src/lib/services/server-content-service", () => ({
  serverContentService: state,
}));
vi.mock("../apps/web/src/lib/services/organization-content-service", () => ({
  organizationContentService: state,
}));
vi.mock("../apps/web/src/components/author-publication-restore", () => ({
  AuthorPublicationRestore: ({
    organizationId,
    serverId,
  }: {
    organizationId?: string;
    serverId?: string;
  }) => <div data-restore={organizationId ?? serverId} />,
}));

import { DiscussionReportsScreen as Reports } from "../apps/web/src/components/discussion-reports-screen";
import { OrganizationPublicationHistoryScreen as History } from "../apps/web/src/components/organization-publication-history-screen";
import { discussionReportsCopy } from "../apps/web/src/lib/discussion-reports-copy";
import { organizationPublicationHistoryCopy } from "../apps/web/src/lib/organization-publication-history-copy";

const time = "2026-10-11T00:00:00.123456Z",
  publication = {
    id: "post",
    title: "Private title",
    slug: "guide",
    type: "post",
    status: "archived",
  };
const reports = {
  publication,
  commentId: "comment",
  removed: true,
  items: [
    {
      id: "report",
      type: "spam",
      reason: "<script>unsafe</script>",
      status: "open",
      createdAt: time,
      resolvedAt: null,
    },
  ],
  hasMore: true,
  nextCursor: "continuation",
};
const history = {
  organization: { id: "org", name: "Team" },
  item: {
    id: "post",
    title: "Private title",
    status: "archived",
    revision: time,
    recoverable: true,
  },
  events: [
    {
      id: "event",
      createdAt: time,
      kind: "archived",
      actor: "team",
      from: "published",
      to: "archived",
      identity: { username: "editor", name: "Editor" },
    },
  ],
  olderCursor: "continuation",
};
beforeEach(() => {
  vi.clearAllMocks();
  state.locale = "en";
  state.session.mockResolvedValue({ id: "actor", role: "moderator" });
  state.discussionReports.mockResolvedValue(reports);
  state.history.mockResolvedValue(history);
});
it.each(["ru", "en"] as const)(
  "renders related report filters, separate decisions and scoped context in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await Reports({
        id: "post",
        commentId: "comment",
        searchParams: Promise.resolve({ q: "word", view: "history", type: "spam" }),
      }),
    );
    expect(html).toContain(discussionReportsCopy(locale).title);
    expect(html).toContain(discussionReportsCopy(locale).removed);
    expect(html).toContain("&lt;script&gt;unsafe&lt;/script&gt;");
    expect(html).toContain("/admin/reports/report");
    expect(html).toContain("/admin/community/post/discussion/comment");
    expect(html).toContain("q=word&amp;view=history&amp;type=spam&amp;cursor=continuation");
    expect(html).not.toContain("/articles/guide");
  },
);
it.each(["ru", "en"] as const)(
  "renders localized shared history, public team identity and scoped draft restore in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await History({ id: "org", contentId: "post" }));
    expect(html).toContain(organizationPublicationHistoryCopy(locale).title);
    expect(html).toContain('data-restore="org"');
    expect(html).toContain("/users/editor");
    expect(html).toContain("/workspace/organizations/org/content/post/history?cursor=continuation");
    expect(html).not.toContain("/articles/guide");
  },
);
it("hides restore when proof is unavailable and retains empty history/support navigation", async () => {
  state.history.mockResolvedValue({
    ...history,
    item: { ...history.item, recoverable: false },
    events: [],
    olderCursor: null,
  });
  const html = renderToStaticMarkup(await History({ id: "org", contentId: "post" }));
  expect(html).not.toContain("data-restore");
  expect(html).toContain("/support");
  expect(html).toContain(
    organizationPublicationHistoryCopy("en").restoreHelp.replaceAll("'", "&#x27;"),
  );
});
it("rejects stale team rights and mismatched private DTOs without showing loaded titles", async () => {
  state.history.mockRejectedValueOnce(new AppError("PRIVATE_ERROR", 403, "FORBIDDEN"));
  const denied = renderToStaticMarkup(await History({ id: "org", contentId: "post" }));
  expect(denied).toContain('role="alert"');
  expect(denied).not.toContain("PRIVATE_ERROR");
  state.history.mockResolvedValue({
    ...history,
    organization: { ...history.organization, id: "foreign" },
  });
  expect(renderToStaticMarkup(await History({ id: "org", contentId: "post" }))).not.toContain(
    "Private title",
  );
  state.discussionReports.mockResolvedValue({ ...reports, commentId: "foreign" });
  expect(renderToStaticMarkup(await Reports({ id: "post", commentId: "comment" }))).not.toContain(
    "Private title",
  );
});
it("does not read private reports for ordinary users or history for anonymous sessions", async () => {
  state.session.mockResolvedValue({ id: "actor", role: "user" });
  expect(renderToStaticMarkup(await Reports({ id: "post", commentId: "comment" }))).toContain(
    'role="alert"',
  );
  expect(state.discussionReports).not.toHaveBeenCalled();
  state.session.mockResolvedValue(null);
  expect(renderToStaticMarkup(await History({ id: "org", contentId: "post" }))).toContain(
    "/auth/login",
  );
  expect(state.history).not.toHaveBeenCalled();
});
it("rejects duplicate filters before either private data source", async () => {
  expect(
    renderToStaticMarkup(
      await Reports({
        id: "post",
        commentId: "comment",
        searchParams: Promise.resolve({ q: ["a", "b"] }),
      }),
    ),
  ).toContain('role="alert"');
  expect(state.discussionReports).not.toHaveBeenCalled();
  expect(
    renderToStaticMarkup(
      await History({
        id: "org",
        contentId: "post",
        searchParams: Promise.resolve({ cursor: ["a", "b"] }),
      }),
    ),
  ).toContain('role="alert"');
  expect(state.history).not.toHaveBeenCalled();
});

it.each(["ru", "en"] as const)(
  "renders private server history, recovery and scoped pagination in %s",
  async (locale) => {
    state.locale = locale;
    const { organization: _organization, ...data } = history;
    state.history.mockResolvedValue({ ...data, server: { id: "srv", name: "Server" } });
    const { ServerPublicationHistoryScreen } = await import(
      "../apps/web/src/components/server-publication-history-screen"
    );
    const { serverPublicationHistoryCopy } = await import(
      "../apps/web/src/lib/server-publication-history-copy"
    );
    const html = renderToStaticMarkup(
      await ServerPublicationHistoryScreen({ id: "srv", contentId: "post" }),
    );
    expect(html).toContain(serverPublicationHistoryCopy(locale).title);
    expect(html).toContain('data-restore="srv"');
    expect(html).toContain("/workspace/servers/srv/content/post/history?cursor=continuation");
    expect(html).toContain("/users/editor");
    expect(html).not.toContain("/workspace/organizations");
  },
);
it("refuses mismatched server DTOs and suppresses restore without current archive proof", async () => {
  const { ServerPublicationHistoryScreen } = await import(
    "../apps/web/src/components/server-publication-history-screen"
  );
  const { organization: _organization, ...data } = history;
  state.history.mockResolvedValue({ ...data, server: { id: "foreign", name: "Private server" } });
  expect(
    renderToStaticMarkup(await ServerPublicationHistoryScreen({ id: "srv", contentId: "post" })),
  ).not.toContain("Private title");
  state.history.mockResolvedValue({
    ...data,
    item: { ...data.item, recoverable: false },
    server: { id: "srv", name: "Server" },
  });
  const html = renderToStaticMarkup(
    await ServerPublicationHistoryScreen({ id: "srv", contentId: "post" }),
  );
  expect(html).not.toContain("data-restore");
  expect(html).toContain("/support");
});
