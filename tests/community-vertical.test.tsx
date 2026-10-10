import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";
import {
  buildCommunityTopicSubmission,
  communityTopicRequest,
  confirmedCommunityTopicPath,
} from "../apps/web/src/lib/community-topic-submission";

const state = vi.hoisted(() => ({
  pathname: "/community",
  topics: [] as Array<Record<string, unknown>>,
}));

const router = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

const listCommunityTopics = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => router,
}));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: React.ReactNode;
    }) => ReactModule.createElement("a", { href, ...props }, children),
  };
});

vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({
    locale: "en",
    dictionary: getDictionary("en"),
  }),
}));

vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: {
    pageCommunity: listCommunityTopics,
  },
}));

import CommunityPage from "../apps/web/src/app/community/page";
import { CommunityTopicForm } from "../apps/web/src/components/community-topic-form";
import { Sidebar } from "../apps/web/src/components/sidebar";

describe("community topic submission behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.pathname = "/community";
    listCommunityTopics.mockResolvedValue({ items: state.topics, page: 1, hasMore: false });
  });

  it("builds only post/question payloads without a client-controlled publication status", () => {
    const submission = buildCommunityTopicSubmission(
      {
        title: "  Vehicle Help: Ä Edition  ",
        body: "  How should this resource be configured?  ",
        type: "question",
        tags: " help, lua, help ",
      },
      123456,
    );

    expect(submission).toEqual({
      title: "Vehicle Help: Ä Edition",
      slug: "vehicle-help-a-edition-2n9c",
      body: "How should this resource be configured?",
      type: "question",
      tags: ["help", "lua", "help"],
    });
    expect(submission).not.toHaveProperty("status");
    expect(
      buildCommunityTopicSubmission({
        title: "Editorial",
        body: "This should not become an article from the community form.",
        type: "article",
        tags: "",
      }),
    ).toBeNull();
  });

  it("builds a private same-origin JSON request and confirms only a canonical success", () => {
    const submission = buildCommunityTopicSubmission(
      {
        title: "Question",
        body: "A sufficiently long community question.",
        type: "post",
        tags: "",
      },
      42,
    );
    expect(submission).not.toBeNull();
    if (!submission) return;

    const signal = new AbortController().signal;
    expect(communityTopicRequest(submission, signal)).toMatchObject({
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
      signal,
    });

    expect(
      confirmedCommunityTopicPath(201, {
        success: true,
        content: { slug: "topic/with/slash" },
      }),
    ).toBe("/articles/topic%2Fwith%2Fslash");
    expect(
      confirmedCommunityTopicPath(200, {
        success: false,
        content: { slug: "topic" },
      }),
    ).toBeNull();
    expect(
      confirmedCommunityTopicPath(500, {
        success: true,
        content: { slug: "topic" },
      }),
    ).toBeNull();
  });

  it("renders the bounded community feed and existing article discussion path", async () => {
    state.topics = [
      {
        id: "cnt_1",
        slug: "vehicle-help",
        type: "question",
        title: "Vehicle Help",
        excerpt: "Need configuration help",
        body: "Fallback body",
        commentCount: 4,
      },
    ];
    listCommunityTopics.mockResolvedValue({ items: state.topics, page: 1, hasMore: false });

    const html = renderToStaticMarkup(await CommunityPage());

    expect(listCommunityTopics).toHaveBeenCalledWith({ page: 1, query: "" });
    expect(html).toContain('href="/community/new"');
    expect(html).toContain('href="/articles/vehicle-help"');
    expect(html).toContain("Vehicle Help");
    expect(html).toContain(">4 ");
  });

  it("renders community navigation and a creation form without publication controls", async () => {
    const sidebar = renderToStaticMarkup(
      <Sidebar
        locale="en"
        isCollapsed={false}
        onToggle={() => undefined}
      />,
    );
    const form = renderToStaticMarkup(<CommunityTopicForm />);

    expect(sidebar).toContain('href="/community"');
    expect(sidebar).toContain(getDictionary("en").nav.community);
    expect(form).toContain('option value="question"');
    expect(form).toContain('option value="post"');
    expect(form).not.toContain('name="status"');
  });
});
