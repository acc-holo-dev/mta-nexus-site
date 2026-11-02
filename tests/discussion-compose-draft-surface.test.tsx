import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { DiscussionComposeWriteFeedback } from "../apps/web/src/components/content-discussion-compose-feedback";
import { getDictionary } from "../apps/web/src/lib/i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/articles/article",
}));
vi.mock("../apps/web/src/lib/discussion-compose-draft", () => ({
  readDiscussionComposeDraft: () => ({
    version: 1,
    contentId: "content",
    text: "Stored draft",
    savedAt: Date.now(),
  }),
  writeDiscussionComposeDraft: vi.fn(),
  clearDiscussionComposeDraft: vi.fn(),
}));

import { ContentDiscussion } from "../apps/web/src/components/content-discussion";

it("announces a session draft restore in the compose form", () => {
  const html = renderToStaticMarkup(
    <ContentDiscussion
      slug="article"
      contentId="content"
      locale="en"
      count={0}
      initial={{ items: [], hasMore: false, nextCursor: null }}
    />,
  );
  expect(html).toContain(getDictionary("en").workspace.draftRestored);
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain("Stored draft");
});

it("shows login and register links when compose write needs sign-in", () => {
  const workspace = getDictionary("en").workspace;
  const html = renderToStaticMarkup(
    <DiscussionComposeWriteFeedback
      error="Sign in to publish"
      needsSignIn
      loginHref="/auth/login?next=%2Farticles%2Fdemo"
      signInLabel={workspace.signIn}
      registerHref="/auth/register?next=%2Farticles%2Fdemo"
      registerLabel={workspace.createAccount}
      onPersistDraft={() => {}}
    />,
  );
  expect(html).toContain('href="/auth/login?next=%2Farticles%2Fdemo"');
  expect(html).toContain('href="/auth/register?next=%2Farticles%2Fdemo"');
  expect(html).toContain(workspace.createAccount);
});
