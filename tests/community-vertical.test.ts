import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPostAuthDestination } from "../apps/web/src/lib/auth-redirect";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("community vertical", () => {
  it("publishes bounded user topics while keeping editorial content moderated", () => {
    const route = read("apps/web/src/app/api/content/route.ts");
    const repository = read("packages/db/src/repositories/content.ts");
    expect(route).toContain('parsed.data.type === "post" || parsed.data.type === "question"');
    expect(route).toContain('can(user, "admin.moderation")');
    expect(repository).toContain("listPublishedByTypes");
    expect(repository).toContain("inArray(content.type, types)");
  });

  it("exposes topic discovery, creation and the existing discussion path", () => {
    const page = read("apps/web/src/app/community/page.tsx");
    const newTopicPage = read("apps/web/src/app/community/new/page.tsx");
    const loginPage = read("apps/web/src/app/auth/login/page.tsx");
    const registerPage = read("apps/web/src/app/auth/register/page.tsx");
    const redirect = read("apps/web/src/lib/auth-redirect.ts");
    const form = read("apps/web/src/components/community-topic-form.tsx");
    const sidebar = read("apps/web/src/components/sidebar.tsx");
    expect(page).toContain("listCommunityTopics");
    expect(form).toContain('fetch("/api/content"');
    expect(form).toContain("/articles/${payload.content.slug}");
    expect(sidebar).toContain('{ href: "/community", label: "Community"');
    expect(newTopicPage).toContain('authService.getSession(cookieStore.get("nexus_session")?.value)');
    expect(newTopicPage).toContain('href="/auth/login?next=%2Fcommunity%2Fnew"');
    expect(newTopicPage).toContain('href="/auth/register?next=%2Fcommunity%2Fnew"');
    expect(newTopicPage).toContain("user ? (");
    expect(loginPage).toContain("getPostAuthDestination(window.location.search)");
    expect(registerPage).toContain("getPostAuthDestination(window.location.search)");
    expect(redirect).toContain('POST_AUTH_DESTINATIONS = new Set(["/community/new"])');
    expect(redirect).toContain(' : "/workspace"');
  });

  it("does not present the unimplemented upvote count as an interactive article feature", () => {
    const articlePage = read("apps/web/src/app/articles/[slug]/page.tsx");
    const articleCard = read("apps/web/src/components/article-card.tsx");
    expect(articlePage).not.toContain("article.likeCount");
    expect(articlePage).not.toContain("Upvotes");
    expect(articlePage).not.toContain("ThumbsUp");
    expect(articleCard).not.toContain("article.likeCount");
    expect(articleCard).not.toContain("ThumbsUp");
  });

  it("allows only the intended local post-auth destination", () => {
    expect(getPostAuthDestination("?next=%2Fcommunity%2Fnew")).toBe("/community/new");
    expect(getPostAuthDestination("?next=https%3A%2F%2Fevil.example")).toBe("/workspace");
    expect(getPostAuthDestination("?next=%2F%2Fevil.example")).toBe("/workspace");
    expect(getPostAuthDestination("?next=javascript%3Aalert(1)")).toBe("/workspace");
    expect(getPostAuthDestination("?next=%2Fadmin")).toBe("/workspace");
  });
});
