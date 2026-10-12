vi.mock("../apps/web/src/components/library-membership-batch", () => ({
  LibraryMembershipBatchForm: () => <div data-membership-batch="review" />,
}));
import { AppError } from "@nexus/domain";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  report: vi.fn(),
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
    default: ({ href, children }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href }, children),
  };
});
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/library-collections-service", () => ({
  libraryCollectionsService: { resourceMemberships: state.report },
}));
vi.mock("../apps/web/src/components/library-collection-command", () => ({
  LibraryCollectionCommandForm: ({
    collection,
    action,
    productId,
    returnHref,
  }: {
    collection: { id: string };
    action: string;
    productId: string;
    returnHref: string;
  }) => (
    <button
      type="button"
      data-collection={collection.id}
      data-action={action}
      data-product={productId}
      data-return={returnHref}
    >
      {action}
    </button>
  ),
}));
import Page, {
  generateMetadata,
  dynamic,
} from "../apps/web/src/app/workspace/library/[id]/collections/page";
import { libraryCollectionsCopy } from "../apps/web/src/lib/library-collections-i18n";
const collection = {
  id: "lcol_a",
  name: "Core & maps",
  status: "active",
  revision: 4,
  itemCount: 200,
  inCollection: true,
};
const report = () => ({
  schemaVersion: 1,
  generatedAt: "2026-10-12T00:00:00.000Z",
  resource: { productId: "prd_a", title: "Safe resource", available: true, canAdd: true },
  collections: [
    collection,
    { ...collection, id: "lcol_new", name: "Empty", itemCount: 0, inCollection: false },
    { ...collection, id: "lcol_full", name: "Full", inCollection: false },
    { ...collection, id: "lcol_archive", name: "Archive", status: "archived" },
    { ...collection, id: "lcol_terminal", name: "Terminal", revision: 2147483647 },
  ],
  collectionLimit: 30,
  itemLimit: 200,
});
const screen = async (query: Record<string, string | string[] | undefined> = {}) =>
  renderToStaticMarkup(
    await Page({ params: Promise.resolve({ id: "prd_a" }), searchParams: Promise.resolve(query) }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.report.mockResolvedValue(report());
});
it.each(["en", "ru"] as const)(
  "renders bounded membership management in %s without file controls",
  async (locale) => {
    state.locale = locale;
    const html = await screen(),
      c = libraryCollectionsCopy(locale);
    expect(html).toContain(c.resourceCollections);
    expect(html).toContain("Core &amp; maps");
    expect(html).toContain('data-collection="lcol_a" data-action="remove"');
    expect(html).toContain('data-collection="lcol_new" data-action="add"');
    for (const id of ["lcol_full", "lcol_archive", "lcol_terminal"])
      expect(html).not.toContain(`data-collection="${id}"`);
    expect(html).toContain(c.fullCollection);
    expect(html).toContain(c.archivedNote);
    expect(html).toContain(c.revisionLocked);
    expect(html).toContain('data-return="/workspace/library/prd_a/collections"');
    expect(html).toContain('href="/api/library/prd_a/collections"');
    expect(html).toContain('href="/workspace/library/prd_a/versions"');
    expect(html).not.toContain("/download");
    expect(html).not.toContain("/api/delivery");
    expect(state.report).toHaveBeenCalledWith(state.actor, "prd_a");
    expect(dynamic).toBe("force-dynamic");
    expect(await generateMetadata()).toEqual({
      title: `${c.resourceCollections} | MTA NEXUS`,
      robots: { index: false, follow: false },
    });
  },
);
it("retains removal and hides names/versions/add controls after access loss", async () => {
  const value = report();
  value.resource = { ...value.resource, title: "Do not reveal", available: false, canAdd: false };
  state.report.mockResolvedValue(value);
  const html = await screen();
  expect(html).not.toContain("Do not reveal");
  expect(html).not.toContain('data-action="add"');
  expect(html).toContain('data-action="remove"');
  expect(html).not.toContain('href="/workspace/library/prd_a/versions"');
  expect(html).toContain(libraryCollectionsCopy("en").noAddAccess);
});
it("allows acquired references with a hidden unsafe publication title to be added", async () => {
  const value = report();
  value.resource.available = false;
  state.report.mockResolvedValue(value);
  const html = await screen();
  expect(html).not.toContain("Safe resource");
  expect(html).toContain('data-action="add"');
  expect(html).not.toContain('href="/workspace/library/prd_a/versions"');
});
it("authenticates before scope or selector inspection", async () => {
  state.actor = null;
  const html = await screen({ userId: "other" });
  expect(html).toContain(libraryCollectionsCopy("en").signInRequired);
  expect(state.report).not.toHaveBeenCalled();
});
it.each([{ userId: "other" }, { page: "1" }, { q: "hidden" }, { page: ["1", "2"] }])(
  "rejects query selectors before reading memberships %o",
  async (query) => {
    const html = await screen(query);
    expect(html).toContain('role="alert"');
    expect(state.report).not.toHaveBeenCalled();
  },
);
it("maps unknown and foreign resources to a missing page", async () => {
  state.report.mockRejectedValue(new AppError("hidden title", 404, "NOT_FOUND"));
  await expect(screen()).rejects.toThrow("NEXT_NOT_FOUND");
});
it("links empty collection state to creation", async () => {
  state.report.mockResolvedValue({ ...report(), collections: [] });
  const html = await screen();
  expect(html).toContain(libraryCollectionsCopy("en").empty);
  expect(html).toContain('href="/workspace/library/collections"');
  expect(html).not.toContain('data-action="');
});
