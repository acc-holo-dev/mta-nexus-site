import { AppError, compareLibraryReleases, type LibraryComparableRelease } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en",
  compare: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => h.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => h.actor },
}));
vi.mock("../apps/web/src/lib/services/resource-release-control-service", () => ({
  libraryReleaseService: { compare: h.compare },
}));
import { LibraryReleaseComparisonScreen } from "../apps/web/src/components/library-release-comparison-screen";
const release = (id: string, hash: string): LibraryComparableRelease => ({
  id,
  version: id,
  createdAt: new Date("2026-10-12T00:00:00Z"),
  sha256Hash: hash.repeat(64),
  fileSizeBytes: 100,
  fileName: "resource.zip",
  mimeType: "application/zip",
  releaseNotes: "<script>safe as text</script>",
  mtaVersionTarget: "1.6.0",
  isSigned: false,
  packageEvidence: null,
});
const query = { from: "bld_a", to: "bld_b", returnPage: "2" };
const screen = async (raw: Record<string, string | string[] | undefined> = query) =>
  renderToStaticMarkup(
    await LibraryReleaseComparisonScreen({
      params: Promise.resolve({ id: "prd_a" }),
      searchParams: Promise.resolve(raw),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  h.actor = { id: "usr_a", role: "user" };
  h.locale = "en";
  h.compare.mockResolvedValue({
    product: { id: "prd_a", title: "Current & resource", slug: "current" },
    generatedAt: "2026-10-12T00:00:00.000Z",
    returnPage: 2,
    selection: { revision: 3, mode: "latest", buildId: null },
    ...compareLibraryReleases(release("bld_a", "a"), release("bld_b", "b")),
  });
});
it.each(["en", "ru"])(
  "renders an exact neutral comparison in %s with an explicitly confirmed choice and no download action",
  async (locale) => {
    h.locale = locale;
    const html = await screen();
    expect(html).toContain(locale === "ru" ? "Сравнить выпуски" : "Compare releases");
    expect(html).toContain("Current &amp; resource");
    expect(html).toContain("a".repeat(64));
    expect(html).toContain("b".repeat(64));
    expect(html).toContain("&lt;script&gt;safe as text&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("data-download");
    expect(html).not.toContain('type="submit"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain(locale === "ru" ? "Я изучил сравнение" : "I reviewed this comparison");
    expect(html).toContain(locale === "ru" ? "Закрепить сравниваемый" : "Fix the compared");
    expect(html).toContain('disabled=""');
  },
);
it("retains reference pair and return page in export and swaps the direction explicitly", async () => {
  const html = await screen();
  expect(html).toContain("/versions?page=2");
  expect(html).toContain("from=bld_b&amp;to=bld_a&amp;returnPage=2");
  expect(html).toContain("/compare/export?from=bld_a&amp;to=bld_b&amp;returnPage=2");
});
it("requires current actor, unambiguous query and current release authorization", async () => {
  h.actor = null;
  await expect(screen()).rejects.toThrow("NOT_FOUND");
  expect(h.compare).not.toHaveBeenCalled();
  h.actor = { id: "usr_a", role: "user" };
  await expect(screen({ ...query, from: ["bld_a", "bld_c"] })).rejects.toThrow("NOT_FOUND");
  expect(h.compare).not.toHaveBeenCalled();
  h.compare.mockRejectedValueOnce(new AppError("Unavailable", 404, "NOT_FOUND"));
  await expect(screen()).rejects.toThrow("NOT_FOUND");
});

it("shows an already fixed target without offering another confirmation", async () => {
  const result = await h.compare();
  h.compare.mockResolvedValue({
    ...result,
    selection: { revision: 4, mode: "fixed", buildId: "bld_b" },
  });
  const html = await screen();
  expect(html).toContain("already your fixed download choice");
  expect(html).not.toContain('type="checkbox"');
  expect(h.compare).toHaveBeenCalledWith(h.actor, "prd_a", {
    from: "bld_a",
    to: "bld_b",
    returnPage: 2,
  });
});
