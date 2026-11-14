vi.mock("../../../components/follow-button", () => ({
  FollowButton: (props: { initial?: unknown }) => (
    <button type="button" data-follow-initial={JSON.stringify(props.initial ?? null)}>
      Follow
    </button>
  ),
}));

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  showActivity: true,
  user: {
    id: "author",
    username: "creator",
    displayName: "Creator",
    bio: "Author bio",
    role: "developer",
    isVerified: false,
  } as null | {
    id: string;
    username: string;
    displayName: string;
    bio: string;
    role: string;
    isVerified: boolean;
  },
  products: vi.fn(),
  session: vi.fn(async (): Promise<{ id: string; role: string } | null> => null),
  followStates: vi.fn(async (): Promise<string[]> => []),
  muteState: vi.fn(async () => ({ muted: false, mutedUntil: null as string | null })),
}));
vi.mock("../../../lib/services/auth-service", () => ({
  authService: {
    getUserByUsername: async () => state.user,
    getSession: () => state.session(),
  },
}));
vi.mock("@nexus/db", () => ({
  productRepository: { pagePublishedFreeByAuthor: state.products },
  followWorkspaceRepository: {
    states: state.followStates,
    muteState: state.muteState,
  },
}));
vi.mock("../../../lib/services/product-service", () => ({
  productService: {
    getPublicAttributions: async () => new Map(),
  },
}));
vi.mock("../../../lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
  getRequestCookieStore: async () => ({ get: () => ({ value: "session" }) }),
}));
vi.mock("../../../lib/services/profile-privacy-service", () => ({
  profilePrivacyService: {
    visibility: async () => ({ showActivity: state.showActivity, showProfessionalContacts: true }),
  },
}));
vi.mock("../../../features/resources/view", () => ({
  ProductCard: ({ product }: { product: { title: string } }) => <article>{product.title}</article>,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@nexus/ui", () => ({
  Avatar: () => null,
  StatCard: ({ label, value }: { label: string; value: string | number }) => (
    <p>
      {label}: {value}
    </p>
  ),
  EmptyState: ({
    title,
    description,
    action,
  }: {
    title: string;
    description: string;
    action?: ReactNode;
  }) => (
    <div>
      <p>{title}</p>
      <p>{description}</p>
      {action}
    </div>
  ),
  ErrorState: ({ title, action }: { title: string; action?: ReactNode }) => (
    <div role="alert">
      <h2>{title}</h2>
      {action}
    </div>
  ),
}));

import { getDictionary } from "../../../lib/i18n";
import Page, { generateMetadata } from "./page";

const params = () => ({ params: Promise.resolve({ username: "creator" }) });

beforeEach(() => {
  state.locale = "en";
  state.showActivity = true;
  state.user = {
    id: "author",
    username: "creator",
    displayName: "Creator",
    bio: "Author bio",
    role: "developer",
    isVerified: false,
  };
  state.products.mockReset();
  state.session.mockReset();
  state.followStates.mockReset();
  state.muteState.mockReset();
  state.session.mockResolvedValue(null);
  state.followStates.mockResolvedValue([]);
  state.muteState.mockResolvedValue({ muted: false, mutedUntil: null });
  state.products.mockResolvedValue({
    products: [{ id: "outside-global-top-100", title: "Author's published resource" }],
    total: 49,
    page: 1,
    pageSize: 24,
    totalPages: 3,
  });
});

it("SSR-hydrates guest developer follow controls without querying mute state", async () => {
  const html = renderToStaticMarkup(await Page(params()));
  expect(state.followStates).not.toHaveBeenCalled();
  expect(state.muteState).not.toHaveBeenCalled();
  expect(html).toContain(
    'data-follow-initial="{&quot;authenticated&quot;:false,&quot;actorId&quot;:null,&quot;following&quot;:false,&quot;muted&quot;:false,&quot;mutedUntil&quot;:null}"',
  );
});

it("SSR-hydrates authenticated developer follow and mute", async () => {
  state.session.mockResolvedValue({ id: "viewer", role: "user" });
  state.followStates.mockResolvedValue(["author"]);
  state.muteState.mockResolvedValue({
    muted: true,
    mutedUntil: "2026-12-01T00:00:00.000Z",
  });
  const html = renderToStaticMarkup(await Page(params()));
  expect(state.followStates).toHaveBeenCalledWith("viewer", "user", ["author"]);
  expect(state.muteState).toHaveBeenCalledWith("viewer", "user", "author");
  expect(html).toContain("&quot;authenticated&quot;:true");
  expect(html).toContain("&quot;following&quot;:true");
  expect(html).toContain("&quot;muted&quot;:true");
  expect(html).toContain("2026-12-01T00:00:00.000Z");
});

it.each(["en", "ru"] as const)(
  "renders author-scoped resources with one h1 in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await Page(params()));
    expect(state.products).toHaveBeenCalledWith("author", 1, 24);
    expect(html).toContain("published resource");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("Creator");
    expect(html).toContain("min-w-0 space-y-10 overflow-x-clip");
    expect(html).toContain("min-h-11");
  },
);

it("uses the canonical developer URL and bounded profile description", async () => {
  if (!state.user) throw new Error("Missing test user");
  state.user.bio = "x".repeat(200);
  expect(await generateMetadata(params())).toMatchObject({
    title: "Creator (@creator)",
    description: "x".repeat(155),
    alternates: { canonical: "/developers/creator" },
  });
});

it.each(["user", "moderator", "server_owner"])(
  "does not expose a developer page for role %s",
  async (role) => {
    if (!state.user) throw new Error("Missing test user");
    state.user.role = role;
    await expect(Page(params())).rejects.toThrow("NOT_FOUND");
    expect(state.products).not.toHaveBeenCalled();
    expect(await generateMetadata(params())).toMatchObject({
      robots: { index: false, follow: false },
    });
  },
);

it("returns not found without resource queries for an absent profile", async () => {
  state.user = null;
  await expect(Page(params())).rejects.toThrow("NOT_FOUND");
  expect(state.products).not.toHaveBeenCalled();
});

it("renders the total and navigation for the requested author page", async () => {
  state.products.mockResolvedValue({
    products: [{ id: "second", title: "Second page resource" }],
    total: 49,
    page: 2,
    pageSize: 24,
    totalPages: 3,
  });
  const html = renderToStaticMarkup(
    await Page({ ...params(), searchParams: Promise.resolve({ page: "2" }) }),
  );
  expect(state.products).toHaveBeenCalledWith("author", 2, 24);
  expect(html).toContain('href="/developers/creator?page=1#resources"');
  expect(html).toContain('href="/developers/creator?page=3#resources"');
  expect(html).toContain("49");
  expect(html).toContain("Second page resource");
});

it.each(["0", "-1", "1.5", "abc", ["2", "3"]])("normalizes invalid page %j", async (page) => {
  await Page({ ...params(), searchParams: Promise.resolve({ page }) });
  expect(state.products).toHaveBeenCalledWith("author", 1, 24);
});

it("does not offer navigation for an empty portfolio", async () => {
  state.products.mockResolvedValue({
    products: [],
    total: 0,
    page: 1,
    pageSize: 24,
    totalPages: 1,
  });
  const html = renderToStaticMarkup(await Page(params()));
  expect(html).not.toContain('rel="next"');
  expect(html).not.toContain('rel="prev"');
  expect(html).toContain('href="/market?maxPrice=0"');
  expect(html).toContain(getDictionary("en").developers.noReleases);
  expect(html).toContain(getDictionary("en").developers.noReleasesHint);
  expect(html).not.toContain('role="alert"');
});

it.each(["en", "ru"] as const)(
  "shows creator load failures as alerts instead of an empty portfolio in %s",
  async (locale) => {
    state.locale = locale;
    const copy = getDictionary(locale).developers;
    state.products.mockRejectedValueOnce(new Error("private-database-detail"));
    const html = renderToStaticMarkup(await Page(params()));
    expect(html).toContain('role="alert"');
    expect(html).toContain(copy.loadUnavailable);
    expect(html).toContain('href="/developers/creator"');
    expect(html).toContain(getDictionary(locale).errors.retry);
    expect(html).toContain("min-h-11");
    expect(html).toContain("overflow-x-clip");
    expect(html).not.toContain("private-database-detail");
    expect(html).not.toContain("published resource");
  },
);
it("hides personal activity links without hiding published resources", async () => {
  state.showActivity = false;
  const html = renderToStaticMarkup(await Page(params()));
  expect(html).not.toContain('href="/users/creator/activity"');
  expect(html).toContain("published resource");
  state.showActivity = true;
  expect(renderToStaticMarkup(await Page(params()))).toContain('href="/users/creator/activity"');
});

it("keeps Trust and Publications as separately focusable profile links", async () => {
  const html = renderToStaticMarkup(await Page(params()));
  expect(html).toContain('href="/users/creator/trust"');
  expect(html).toContain('href="/users/creator/activity"');
  expect(html).toMatch(/aria-label="Creator profile"/);
  expect(html).toContain("sm:gap-x-5");
});
