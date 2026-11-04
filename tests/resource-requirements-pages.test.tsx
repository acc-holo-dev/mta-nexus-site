import { buildResourceRequirementsReport, type ResourceRequirementNode } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en",
  report: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/library/prd_a/requirements",
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/resource-requirements-service", () => ({
  resourceRequirementsService: { report: state.report },
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

import AdminResourceRequirementsLoading from "../apps/web/src/app/admin/resources/[id]/requirements/loading";
import { ResourceRequirementsScreen as screen } from "../apps/web/src/components/resource-requirements-screen";
import { resourceRequirementsCopy } from "../apps/web/src/lib/resource-requirements-i18n";

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
  return buildResourceRequirementsReport({
    rootSlug: "root",
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
    scope: "library",
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
it.each(["en", "ru"])(
  "renders localized diagnostics, exact downloads and missing-dependency cart controls in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await screen({ productId: "prd_a", scope: "library", raw: { targetMta: "1.6.0" } }),
    );
    expect(html).toContain(locale === "ru" ? "Подготовка ресурсов" : "Resource preparation");
    expect(html).toContain('data-build="bld_a"');
    expect(html).toContain('data-cart="prd_b"');
    expect(html).not.toContain('data-product="prd_b"');
    expect(html).toContain("/api/library/prd_a/requirements/export?targetMta=1.6.0");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  },
);
it("does not inspect resources for signed-out visitors", async () => {
  state.actor = null;
  const guest = renderToStaticMarkup(
    await screen({ productId: "prd_a", scope: "library", raw: {} }),
  );
  expect(guest).toContain("Sign in required");
  expect(guest).toContain("/auth/login?next=");
  expect(guest).toContain("%2Fworkspace%2Flibrary%2Fprd_a%2Frequirements");
  expect(state.report).not.toHaveBeenCalled();
});
it("blocks ordinary users from the moderator screen before reading the resource", async () => {
  await expect(screen({ productId: "prd_a", scope: "moderator", raw: {} })).rejects.toThrow(
    "NOT_FOUND",
  );
  expect(state.report).not.toHaveBeenCalled();
});
it("does not offer download or acquisition actions in publisher previews", async () => {
  const html = renderToStaticMarkup(
    await screen({ productId: "prd_a", scope: "publisher", raw: { buildId: "bld_a" } }),
  );
  expect(html).toContain("Publisher/moderator preview");
  expect(html).not.toContain("data-build=");
  expect(html).not.toContain("data-cart=");
  expect(state.report).toHaveBeenCalledWith("usr_a", "prd_a", "publisher", { buildId: "bld_a" });
});
it("rejects unsupported query parameters before loading data", async () => {
  await expect(
    screen({ productId: "prd_a", scope: "library", raw: { buildId: "bld_a" } }),
  ).rejects.toThrow("NOT_FOUND");
  expect(state.report).not.toHaveBeenCalled();
});

it.each(["en", "ru"])(
  "preserves a read-only preview and comparison return path in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await screen({
        productId: "prd_a",
        scope: "library",
        raw: { previewBuildId: "bld_b", returnFrom: "bld_a", returnPage: "2", targetMta: "1.6.0" },
      }),
    );
    expect(html).toContain(
      locale === "ru" ? "Выбор версии не меняется" : "Your version choice is unchanged",
    );
    expect(html).toContain("/versions/compare?from=bld_a&amp;to=bld_b&amp;returnPage=2");
    expect(html).toContain('name="previewBuildId" value="bld_b"');
    expect(html).toContain('name="returnFrom" value="bld_a"');
    expect(html).toContain('name="returnPage" value="2"');
    expect(html).toContain(
      "/requirements/export?previewBuildId=bld_b&amp;returnFrom=bld_a&amp;returnPage=2&amp;targetMta=1.6.0",
    );
    expect(html).not.toContain("data-build=");
    expect(html).toContain('data-cart="prd_b"');
  },
);
it("shows an honest recovery state when the preparation report fails", async () => {
  state.report.mockRejectedValue(new Error("report unavailable"));
  const copy = resourceRequirementsCopy("en");
  const html = renderToStaticMarkup(
    await screen({ productId: "prd_a", scope: "library", raw: { targetMta: "1.6.0" } }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("targetMta=1.6.0");
  expect(html).not.toContain("Private");
});
it("shows an honest staff recovery state for moderator requirements", async () => {
  state.actor = { id: "usr_staff", role: "moderator" };
  state.report.mockRejectedValue(new Error("report unavailable"));
  const copy = resourceRequirementsCopy("en");
  const html = renderToStaticMarkup(
    await screen({
      productId: "prd_a",
      scope: "moderator",
      raw: { buildId: "bld_a", targetMta: "1.6.0" },
    }),
  );
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain(
    'href="/admin/resources/prd_a/requirements?buildId=bld_a&amp;targetMta=1.6.0"',
  );
  expect(html).not.toContain("Private");
});
it("clips honest loading shells on narrow layouts", async () => {
  const html = renderToStaticMarkup(await AdminResourceRequirementsLoading());
  expect(html).toContain("min-w-0 max-w-5xl");
  expect(html).toContain("overflow-x-clip");
});
