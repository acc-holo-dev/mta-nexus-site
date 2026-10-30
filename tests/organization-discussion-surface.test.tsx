import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ContentDiscussion } from "../apps/web/src/components/content-discussion";
import { OrganizationProfileForm } from "../apps/web/src/components/organization-profile-form";
import { OrganizationWorkspacePanel } from "../apps/web/src/components/organization-workspace";
import { getDiscussionCopy } from "../apps/web/src/lib/content-discussion-copy";
import type { OrganizationWorkspace } from "../apps/web/src/lib/organization-workspace-contract";
import { getOrganizationCopy } from "../apps/web/src/lib/organization-workspace-copy";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const organization = {
  id: "org",
  slug: "team",
  name: "Team",
  description: "Description",
  logoUrl: "",
  websiteUrl: "",
  ownerId: "owner",
  isVerified: false,
  updatedAt: "2026-10-10T12:00:00.000Z",
};
const member = {
  id: "member",
  username: "member",
  displayName: "Member",
  avatarUrl: null,
  role: "developer",
  managesServers: true,
  joinedAt: organization.updatedAt,
};
const workspace: OrganizationWorkspace = {
  organization,
  role: "owner",
  owner: { id: "owner", username: "owner", displayName: "Owner", avatarUrl: null },
  members: [member],
  page: 2,
  hasMore: true,
};
it.each(["en", "ru"] as const)(
  "renders actionable localized organization forms in %s",
  (locale) => {
    const copy = getOrganizationCopy(locale);
    const creation = renderToStaticMarkup(<OrganizationProfileForm locale={locale} />);
    expect(creation).toContain(copy.create);
    expect(creation).toMatch(/maxlength="80"/iu);
    expect(creation).toContain('type="url"');
    const html = renderToStaticMarkup(
      <OrganizationWorkspacePanel
        initial={workspace}
        locale={locale}
        actorId="owner"
        query="lua"
      />,
    );
    expect(html).toContain(copy.team);
    expect(html).toContain(copy.add);
    expect(html).toContain(copy.remove);
    expect(html).toContain("rounded-lg");
    expect(html).toContain('value="admin"');
    expect(html).toContain("/workspace/organizations/org?q=lua&amp;page=3");
    expect(html).toMatch(/readonly=""/iu);
    expect(html).toContain("/users/member");
  },
);
it("protects peer administrators in the administrator interface", () => {
  const html = renderToStaticMarkup(
    <OrganizationWorkspacePanel
      initial={{ ...workspace, role: "admin", members: [{ ...member, role: "admin" }] }}
      locale="en"
      actorId="actor"
      query=""
    />,
  );
  expect(html).not.toContain('value="admin"');
  expect(html).not.toContain(getOrganizationCopy("en").remove);
});
it("renders a genuinely read-only member workspace", () => {
  const html = renderToStaticMarkup(
    <OrganizationWorkspacePanel
      initial={{ ...workspace, role: "member" }}
      locale="en"
      actorId="member"
      query=""
    />,
  );
  expect(html).toContain(getOrganizationCopy("en").readOnly);
  expect(html).not.toContain(getOrganizationCopy("en").add);
  expect(html).toContain(getOrganizationCopy("en").leave);
  expect(html).toContain("rounded-lg");
  expect(html).toContain('disabled=""');
});
it.each(["en", "ru"] as const)(
  "renders authors, escaped replies, count and older-page action in %s",
  (locale) => {
    const copy = getDiscussionCopy(locale);
    const html = renderToStaticMarkup(
      <ContentDiscussion
        slug="article"
        contentId="content"
        locale={locale}
        count={345}
        initial={{
          items: [
            {
              id: "comment",
              text: "<script>alert(1)</script>",
              parentId: "parent",
              createdAt: organization.updatedAt,
              author: { id: "author", username: "author", displayName: "Author", avatarUrl: null },
              parent: { text: "Earlier <message>", username: "parent_author" },
            },
          ],
          hasMore: true,
          nextCursor: "cursor",
        }}
      />,
    );
    expect(html).toContain(`${copy.title} (345)`);
    expect(html).toContain(copy.older);
    expect(html).toContain(copy.reply);
    expect(html).toContain("/users/author");
    expect(html).toContain('href="/auth/login"');
    expect(html).toContain("@parent_author");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toMatch(/maxlength="5000"/iu);
  },
);
it("distinguishes initial read failure from an empty discussion", () => {
  const failure = renderToStaticMarkup(
    <ContentDiscussion slug="article" contentId="content" locale="en" count={0} initial={null} />,
  );
  expect(failure).toContain('role="alert"');
  expect(failure).not.toContain(getDiscussionCopy("en").first);
  const empty = renderToStaticMarkup(
    <ContentDiscussion
      slug="article"
      contentId="content"
      locale="en"
      count={0}
      initial={{ items: [], hasMore: false, nextCursor: null }}
    />,
  );
  expect(empty).toContain(getDiscussionCopy("en").first);
});
