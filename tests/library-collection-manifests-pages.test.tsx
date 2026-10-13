import ReconcilePage, {
  generateMetadata as reconcileMetadata,
} from "../apps/web/src/app/workspace/library/collections/[id]/reconcile/page";
import { AppError } from "@nexus/domain";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  history: vi.fn(),
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
  libraryCollectionsService: { exportManifest: state.history },
}));

vi.mock("../apps/web/src/components/library-collection-import", () => ({
  LibraryCollectionImport: ({
    collection,
    locale,
  }: {
    collection: { id: string };
    locale: string;
  }) => <div data-import={collection.id} data-locale={locale} />,
}));
import Page, {
  dynamic,
  generateMetadata,
} from "../apps/web/src/app/workspace/library/collections/[id]/import/page";
import { libraryCollectionManifestsCopy } from "../apps/web/src/lib/library-collection-manifests-i18n";
const collection = { id: "lcol_a", name: "Private & name", status: "active", revision: 7 };
const screen = async (query: Record<string, string | string[] | undefined> = {}, id = "lcol_a") =>
  renderToStaticMarkup(
    await Page({ params: Promise.resolve({ id }), searchParams: Promise.resolve(query) }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.history.mockResolvedValue({
    schemaVersion: 1,
    generatedAt: "2026-10-12T00:00:00.000Z",
    collection,
    productIds: ["PRIVATE-REFERENCE"],
  });
});
it.each(["en", "ru"] as const)(
  "renders a private import page with localized metadata and full export link in %s",
  async (locale) => {
    state.locale = locale;
    const html = await screen();
    expect(html).toContain(libraryCollectionManifestsCopy(locale).title);
    expect(html).toContain("Private &amp; name");
    expect(html).toContain('data-import="lcol_a"');
    expect(html).toContain(`/api/library/collections/lcol_a/export`);
    expect(html).not.toContain("PRIVATE-REFERENCE");
    expect(state.history).toHaveBeenCalledWith(state.actor, "lcol_a");
    expect(dynamic).toBe("force-dynamic");
    expect(await generateMetadata()).toEqual({
      title: `${libraryCollectionManifestsCopy(locale).title} | MTA NEXUS`,
      robots: { index: false, follow: false },
    });
  },
);
it("authenticates before receipt or selector inspection", async () => {
  state.actor = null;
  expect(await screen({ userId: "other" })).toContain("Sign in");
  expect(state.history).not.toHaveBeenCalled();
});
it.each([{ userId: "other" }, { page: "1" }, { q: ["a", "b"] }])(
  "rejects all import selectors %o before own reads",
  async (query) => {
    expect(await screen(query)).toContain('role="alert"');
    expect(state.history).not.toHaveBeenCalled();
  },
);
it("maps missing or foreign collection to the same unavailable page", async () => {
  state.history.mockRejectedValue(new AppError("PRIVATE", 404, "NOT_FOUND"));
  await expect(screen({}, "lcol_foreign")).rejects.toThrow("NEXT_NOT_FOUND");
});

it.each(["en", "ru"] as const)(
  "renders the private reconciliation page with localized metadata in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await ReconcilePage({
        params: Promise.resolve({ id: "lcol_a" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain(libraryCollectionManifestsCopy(locale).reconcileTitle);
    expect(await reconcileMetadata()).toMatchObject({
      title: `${libraryCollectionManifestsCopy(locale).reconcileTitle} | MTA NEXUS`,
      robots: { index: false, follow: false },
    });
  },
);
