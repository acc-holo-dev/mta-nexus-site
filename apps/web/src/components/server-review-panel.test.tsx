import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/servers/demo",
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

  it("shows unavailable with retry instead of empty total=0", () => {
    const html = renderToStaticMarkup(
      createElement(ServerReviewPanel, {
        serverId: "srv_a",
        loadState: "unavailable",
      }),
    );
    expect(html).toContain("Reviews are temporarily unavailable");
    expect(html).toContain("Retry loading reviews");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("No follow-based reviews yet.");
    expect(html).not.toContain("Follow-based reviews (0)");
  });

  it("keeps a successful empty page as a real empty state", () => {
    const html = renderToStaticMarkup(
      createElement(ServerReviewPanel, {
        serverId: "srv_a",
        initialPage: emptyPage,
      }),
    );
    expect(html).toContain("Follow-based reviews (0)");
    expect(html).toContain("No follow-based reviews yet.");
    expect(html).not.toContain("Reviews are temporarily unavailable");
  });

  it("renders a nonempty page without pretending it failed", () => {
    const html = renderToStaticMarkup(
      createElement(ServerReviewPanel, {
        serverId: "srv_a",
        initialPage: filledPage,
      }),
    );
    expect(html).toContain("Follow-based reviews (1)");
    expect(html).toContain("Solid community");
    expect(html).not.toContain("Reviews are temporarily unavailable");
  });
});
