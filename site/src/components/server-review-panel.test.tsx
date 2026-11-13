import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverReviewCopy, serverReviewLoadCopy } from "../lib/server-review-i18n";

vi.mock("./locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/servers/demo",
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

import { ServerReviewPanel } from "./server-review-panel";

const emptyPage = { reviews: [], total: 0, page: 1, totalPages: 1 };
const filledPage = {
  reviews: [
    {
      id: "cmt_1",
      text: "Solid community",
      rating: 5,
      status: "published" as const,
      revision: 1,
      interactionSource: "follow" as const,
      author: { username: "alex", displayName: "Alex" },
    },
  ],
  total: 1,
  page: 1,
  totalPages: 1,
};

describe("server review panel honest load states", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
  });

  it("shows ErrorState with touch retry instead of empty total=0", () => {
    const copy = serverReviewCopy("en");
    const loadCopy = serverReviewLoadCopy("en");
    const html = renderToStaticMarkup(
      createElement(ServerReviewPanel, {
        serverId: "srv_a",
        loadState: "unavailable",
      }),
    );
    expect(html).toContain(loadCopy.unavailable);
    expect(html).toContain(loadCopy.retry);
    expect(html).toContain('role="alert"');
    expect(html).toContain("min-h-11");
    expect(html).not.toContain(copy.empty);
    expect(html).not.toContain(`${copy.all} (0)`);
  });

  it("keeps a successful empty page as EmptyState", () => {
    const copy = serverReviewCopy("en");
    const html = renderToStaticMarkup(
      createElement(ServerReviewPanel, {
        serverId: "srv_a",
        initialPage: emptyPage,
      }),
    );
    expect(html).toContain(`${copy.all} (0)`);
    expect(html).toContain(copy.empty);
    expect(html).toContain(copy.emptyHint);
    expect(html).toContain("border-dashed");
    expect(html).not.toContain(serverReviewLoadCopy("en").unavailable);
  });

  it("renders a nonempty page without pretending it failed", () => {
    const copy = serverReviewCopy("en");
    const html = renderToStaticMarkup(
      createElement(ServerReviewPanel, {
        serverId: "srv_a",
        initialPage: filledPage,
      }),
    );
    expect(html).toContain(`${copy.all} (1)`);
    expect(html).toContain("Solid community");
    expect(html).not.toContain(serverReviewLoadCopy("en").unavailable);
    expect(html).not.toContain(copy.empty);
  });
});
