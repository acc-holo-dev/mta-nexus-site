import { AppError } from "@nexus/domain";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  comparison: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/library-collections-service", () => ({
  libraryCollectionsService: { comparison: state.comparison },
}));
vi.mock("../apps/web/src/components/library-collection-item-copy", () => ({
  LibraryCollectionItemCopyForm: ({
    source,
    items,
    destinations,
    move,
    initialDestinationId,
  }: {
    source: { id: string; revision: number };
    items: { productId: string }[];
    destinations: { id: string; revision: number; presentProductIds: string[] }[];
    move: boolean;
    initialDestinationId: string;
  }) => (
    <button
      type="button"
      data-transfer={move ? "move" : "copy"}
      data-source={source.id}
      data-source-revision={source.revision}
      data-destination={initialDestinationId}
      data-references={items.map((item) => item.productId).join(",")}
      data-present={destinations[0]?.presentProductIds.join(",")}
    >
      Transfer
    </button>
  ),
}));
import Page, {
  dynamic,
  generateMetadata,
} from "../apps/web/src/app/workspace/library/collections/[id]/compare/page";
import { libraryCollectionComparisonCopy } from "../apps/web/src/lib/library-collection-comparison-i18n";
const source = {
    id: "lcol_a",
    name: "Source & name",
    status: "archived",
    revision: 4,
    itemCount: 2,
  },
  destination = { id: "lcol_b", name: "Destination", status: "active", revision: 2, itemCount: 2 };
const report = () => ({
  schemaVersion: 1,
  generatedAt: "2026-10-12T00:00:00.000Z",
  source,
  targets: [destination],
  itemLimit: 200,
  comparison: {
    destination,
    counts: { all: 3, sourceOnly: 1, destinationOnly: 1, common: 1, unavailable: 2 },
    items: [
      {
        productId: "prd_a",
        title: "Accessible",
        available: true,
        inSource: true,
        inDestination: false,
      },
      {
        productId: "prd_common",
        title: "PRIVATE",
        available: false,
        inSource: true,
        inDestination: true,
      },
      {
        productId: "prd_destination",
        title: null,
        available: false,
        inSource: false,
        inDestination: true,
      },
    ],
    page: 2,
    pageSize: 20,
    total: 21,
    totalPages: 3,
    filter: "all",
    q: "",
    transfer: "copy",
  },
});
const screen = async (
  query: Record<string, string | string[] | undefined> = { to: "lcol_b", page: "2" },
) =>
  renderToStaticMarkup(
    await Page({ params: Promise.resolve({ id: "lcol_a" }), searchParams: Promise.resolve(query) }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.comparison.mockResolvedValue(report());
});
it.each(["en", "ru"] as const)(
  "renders comparison and only own source references in the %s transfer review",
  async (locale) => {
    state.locale = locale;
    const html = await screen(),
      h = libraryCollectionComparisonCopy(locale);
    expect(html).toContain(h.title);
    expect(html).toContain("Source &amp; name");
    expect(html).toContain("Accessible");
    expect(html).not.toContain("PRIVATE");
    expect(html).toContain('data-source-revision="4"');
    expect(html).toContain('data-destination="lcol_b"');
    expect(html).toContain('data-references="prd_a,prd_common"');
    expect(html).toContain('data-present="prd_common"');
    expect(html).toContain("page=1&amp;filter=all&amp;transfer=copy");
    expect(html).toContain("page=3&amp;filter=all&amp;transfer=copy");
    expect(html).not.toContain("/download");
    expect(state.comparison).toHaveBeenCalledWith(state.actor, "lcol_a", {
      to: "lcol_b",
      page: 2,
      filter: "all",
      q: "",
      transfer: "copy",
    });
    expect(dynamic).toBe("force-dynamic");
    expect(await generateMetadata()).toEqual({
      title: `${h.title} | MTA NEXUS`,
      robots: { index: false, follow: false },
    });
  },
);
it("selects move review without applying it and preserves filtered navigation", async () => {
  const value = report();
  value.comparison.transfer = "move";
  value.comparison.filter = "common";
  value.comparison.q = "safe";
  state.comparison.mockResolvedValue(value);
  const html = await screen({
    to: "lcol_b",
    page: "2",
    filter: "common",
    q: "safe",
    transfer: "move",
  });
  expect(html).toContain('data-transfer="move"');
  expect(html).toContain("filter=common&amp;q=safe&amp;transfer=move");
});
it.each(["archived", "terminal"])(
  "does not offer transfers into a %s destination",
  async (mode) => {
    const value = report();
    value.comparison.destination = {
      ...destination,
      ...(mode === "archived" ? { status: "archived" } : { revision: 2147483647 }),
    };
    state.comparison.mockResolvedValue(value);
    const html = await screen();
    expect(html).not.toContain("data-transfer");
    expect(html).toContain(libraryCollectionComparisonCopy("en").destinationReadOnly);
  },
);
it("keeps destination-only pages read-only", async () => {
  const value = report();
  value.comparison.items = value.comparison.items.filter((item) => !item.inSource);
  state.comparison.mockResolvedValue(value);
  const html = await screen();
  expect(html).not.toContain("data-transfer");
  expect(html).toContain(libraryCollectionComparisonCopy("en").noSourceItems);
});
it("chooses an owned comparison target before reading resources", async () => {
  state.comparison.mockResolvedValue({ ...report(), comparison: null });
  const html = await screen({});
  expect(html).toContain(libraryCollectionComparisonCopy("en").choose);
  expect(html).not.toContain("data-transfer");
  expect(html).not.toContain("Accessible");
});
it("authenticates before inspecting query selectors", async () => {
  state.actor = null;
  expect(await screen({ userId: "other" })).toContain("Sign in");
  expect(state.comparison).not.toHaveBeenCalled();
});
it.each([{ userId: "other" }, { to: ["a", "b"] }, { to: "../private" }, { filter: "common" }])(
  "rejects invalid comparison selectors before reading %o",
  async (query) => {
    expect(await screen(query)).toContain('role="alert"');
    expect(state.comparison).not.toHaveBeenCalled();
  },
);
it("masks an unowned source or destination as a missing page", async () => {
  state.comparison.mockRejectedValue(new AppError("private name", 404, "NOT_FOUND"));
  await expect(screen()).rejects.toThrow("NEXT_NOT_FOUND");
});
