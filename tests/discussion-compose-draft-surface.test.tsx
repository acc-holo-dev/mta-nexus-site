import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
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
