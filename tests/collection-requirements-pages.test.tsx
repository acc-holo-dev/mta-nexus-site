import { buildCollectionRequirementsReport, type ResourceRequirementNode } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en",
  report: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/resource-requirements-service", () => ({
  resourceRequirementsService: { collectionReport: state.report },
}));
vi.mock("../apps/web/src/components/resource-download-button", () => ({
  ResourceDownloadButton: ({ productId, buildId }: { productId: string; buildId: string }) => (
    <button type="button" data-product={productId} data-build={buildId}>
      Download
    </button>
  ),
}));
vi.mock("../apps/web/src/components/resource-cart-controls", () => ({
  AddResourceToCart: ({ productId }: { productId: string }) => (
    <button type="button" data-cart={productId}>
      Add to cart
    </button>
  ),
}));

import { CollectionRequirementsScreen as screen } from "../apps/web/src/components/collection-requirements-screen";

const root: ResourceRequirementNode = {
  id: "prd_a",
  slug: "root",
  title: "Private <script>",
  published: true,
  accessible: true,
  selection: "latest",
  dependencies: ["dependency"],
  invalidDeclarations: false,
  minimumMta: "1.6.0",
  build: {
    id: "bld_a",
    version: "1.0",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 16,
    safe: true,
    mtaTarget: null,
    packageStatus: null,
    manifestStatus: null,
    missingReferences: 0,
    issueCount: 0,
  },
};
function fixture() {
  return buildCollectionRequirementsReport({
    collection: { id: "lcol_a", name: "<Core>", status: "active", revision: 4 },
    itemCount: 1,
    unavailableItemCount: 0,
    rootSlugs: ["root"],
    nodes: [
      root,
      {
        ...root,
        id: "prd_b",
        slug: "dependency",
        title: "Dependency",
        dependencies: [],
        accessible: false,
      },
    ],
    targetMta: "1.6.0",
    generatedAt: "2026-10-11T00:00:00Z",
    truncated: false,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.report.mockResolvedValue(fixture());
});

const props = {
  params: Promise.resolve({ id: "lcol_a" }),
  searchParams: Promise.resolve({ targetMta: "1.6.0" }),
};
it.each(["ru", "en"])("renders shared preparation and exact downloads in %s", async (locale) => {
  state.locale = locale;
  const html = renderToStaticMarkup(await screen(props));
  expect(html).toContain(locale === "ru" ? "Готовность коллекции" : "Collection readiness");
  expect(html).toContain("&lt;Core&gt;");
  expect(html).toContain('data-build="bld_a"');
  expect(html).toContain('data-cart="prd_b"');
  expect(html).not.toContain('data-product="prd_b"');
  expect(html).toContain("/api/library/collections/lcol_a/requirements/export?targetMta=1.6.0");
  expect(state.report).toHaveBeenCalledWith("usr_a", "lcol_a", { targetMta: "1.6.0" });
});
it("shows withheld members without claiming that no obstacles exist", async () => {
  const result = fixture();
  result.unavailableItemCount = 1;
  result.state = "blocked";
  state.report.mockResolvedValue({
    ...result,
    report: { ...result.report, nodes: [], issues: [], order: [] },
  });
  const html = renderToStaticMarkup(await screen(props));
  expect(html).toContain("Their private details are hidden");
  expect(html).not.toContain("No obstacles found");
  expect(html).not.toContain("data-build=");
});
it("shows a distinct empty state and retains export", async () => {
  const result = fixture();
  state.report.mockResolvedValue({
    ...result,
    state: "empty",
    itemCount: 0,
    rootSlugs: [],
    report: { ...result.report, nodes: [], issues: [], order: [] },
  });
  const html = renderToStaticMarkup(await screen(props));
  expect(html).toContain("This collection is empty");
  expect(html).not.toContain("No obstacles found");
  expect(html).toContain("/requirements/export");
});
it("rejects invalid or duplicate query fields before loading metadata", async () => {
  await expect(
    screen({ ...props, searchParams: Promise.resolve({ targetMta: ["1.6.0", "1.5.0"] }) }),
  ).rejects.toThrow("NOT_FOUND");
  expect(state.report).not.toHaveBeenCalled();
});
it("requires an authenticated user before querying the collection", async () => {
  state.actor = null;
  await expect(screen(props)).rejects.toThrow("NOT_FOUND");
  expect(state.report).not.toHaveBeenCalled();
});
