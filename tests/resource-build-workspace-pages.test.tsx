import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@nexus/domain";
import { getDictionary } from "../apps/web/src/lib/i18n";
const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  actor: { id: "usr_a" } as { id: string } | null,
  detail: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: state.locale, dictionary: getDictionary(state.locale) }),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/resource-build-workspace-service", () => ({
  resourceBuildWorkspaceService: { detail: state.detail },
}));
import { ResourceBuildScreen } from "../apps/web/src/components/resource-build-screen";
import { generateMetadata } from "../apps/web/src/app/workspace/resources/[id]/builds/[buildId]/page";
const detail = {
  product: { id: "prd_a", title: "<Private resource>", slug: "resource", status: "published" },
  build: {
    id: "bld_a",
    productId: "prd_a",
    version: "1.0.0",
    revision: 3,
    status: "pending_review",
    releaseNotes: "<script>notes</script>",
    mtaVersionTarget: "1.6.0",
    fileName: "archive.zip",
    fileSizeBytes: 42,
    sha256Hash: "a".repeat(64),
    scanStatus: "clean",
    scanner: "scanner",
    scannedAt: new Date("2026-10-11"),
    isSigned: false,
  },
  history: [
    {
      id: "aud_a",
      action: "build.review_withdrawn",
      reason: "<b>Reason</b>",
      createdAt: new Date("2026-10-11"),
    },
  ],
};
beforeEach(() => {
  state.locale = "en";
  state.actor = { id: "usr_a" };
  state.detail.mockReset().mockResolvedValue(detail);
});
it("does not query private versions without a session", async () => {
  state.actor = null;
  const html = renderToStaticMarkup(
    await ResourceBuildScreen({ productId: "prd_a", buildId: "bld_a" }),
  );
  expect(html).toContain("/auth/login");
  expect(state.detail).not.toHaveBeenCalled();
});
it.each(["en", "ru"] as const)(
  "renders %s controls, escaped content and decision history",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await ResourceBuildScreen({ productId: "prd_a", buildId: "bld_a" }),
    );
    expect(html).toContain('href="/workspace/resources/prd_a"');
    expect(html).toContain("&lt;script&gt;notes&lt;/script&gt;");
    expect(html).not.toContain("<script>notes</script>");
    expect(html).toContain("&lt;b&gt;Reason&lt;/b&gt;");
    expect(html).toContain(locale === "ru" ? "Снять с проверки" : "Withdraw from review");
    expect(html).toContain(
      locale === "ru" ? "Последние 20 событий версии" : "Latest 20 version events",
    );
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: false });
  },
);
it("renders revision-bound staff controls and the artifact link", async () => {
  const html = renderToStaticMarkup(
    await ResourceBuildScreen({ productId: "prd_a", buildId: "bld_a", staff: true }),
  );
  expect(state.detail).toHaveBeenCalledWith("prd_a", "bld_a", state.actor, true);
  expect(html).toContain("/api/admin/builds/bld_a/download");
  expect(html).not.toContain("Withdraw from review");
});
it.each([403, 404])("hides inaccessible detail on %s", async (status) => {
  state.detail.mockRejectedValue(new AppError("private", status, "FORBIDDEN"));
  await expect(ResourceBuildScreen({ productId: "prd_a", buildId: "bld_a" })).rejects.toThrow(
    "NOT_FOUND",
  );
});
it("does not expose edit or resubmit controls for quarantined or retired builds", async () => {
  for (const status of ["quarantined", "retired"]) {
    state.detail.mockResolvedValue({ ...detail, build: { ...detail.build, status } });
    const html = renderToStaticMarkup(
      await ResourceBuildScreen({ productId: "prd_a", buildId: "bld_a" }),
    );
    expect(html).not.toContain("Save draft");
    expect(html).not.toContain("Submit for review");
  }
});
