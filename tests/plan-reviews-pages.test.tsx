import { AppError } from "@nexus/domain";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  detail: vi.fn(),
  page: vi.fn(),
  scopes: vi.fn(),
  plan: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NOT_FOUND");
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
vi.mock("../apps/web/src/lib/services/plan-reviews-service", () => ({
  planReviewsService: {
    detail: state.detail,
    page: state.page,
    scopes: state.scopes,
    plan: state.plan,
  },
}));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: state.locale }),
}));

import { commercialFeeEstimate } from "@nexus/domain";
import Detail from "../apps/web/src/app/workspace/subscriptions/reviews/[id]/page";
import New from "../apps/web/src/app/workspace/subscriptions/reviews/new/page";
import History from "../apps/web/src/app/workspace/subscriptions/reviews/page";
import { planReviewsCopy } from "../apps/web/src/lib/plan-reviews-i18n";

const date = new Date("2026-10-11T00:00:00.000Z");
const terms = {
  titleRu: "<script>Тариф</script>",
  titleEn: "<script>Plan</script>",
  descriptionRu: "Описание тарифа",
  descriptionEn: "Plan description",
  price: 900,
  currency: "USD" as const,
  durationDays: 30 as const,
  commissionBps: 750,
};
const review = {
  id: `prev_${"a".repeat(64)}`,
  planId: "cplan_a",
  planRevision: 2,
  scope: "user" as const,
  subjectId: "usr_a",
  terms,
  createdAt: date,
  estimate: commercialFeeEstimate(10000, "RUB", 750),
};
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.detail.mockResolvedValue({
    review,
    observedAt: date,
    state: "changed",
    current: { revision: 4, terms: { ...terms, price: 1000, titleEn: "New plan" } },
  });
  state.page.mockResolvedValue({
    scope: { id: "user:usr_a", name: null },
    observedAt: date,
    reviews: [review],
    page: 2,
    pageSize: 20,
    total: 21,
    totalPages: 2,
  });
  state.scopes.mockResolvedValue({
    scopes: [{ id: "org_a", name: "My organization" }],
    page: 1,
    totalPages: 2,
    total: 21,
    pageSize: 20,
  });
  state.plan.mockResolvedValue({
    id: "cplan_a",
    slug: "plan",
    scope: "user",
    revision: 2,
    status: "published",
    updatedAt: date,
    ...terms,
  });
});
it("signed-out users cannot trigger private history, selection or detail reads", async () => {
  state.actor = null;
  for (const page of [History, New])
    expect(renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }))).toContain(
      "Sign in",
    );
  expect(
    renderToStaticMarkup(
      await Detail({
        params: Promise.resolve({ id: review.id }),
        searchParams: Promise.resolve({}),
      }),
    ),
  ).toContain("Sign in");
  expect(state.page).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
  expect(state.scopes).not.toHaveBeenCalled();
});
it.each(["en", "ru"] as const)(
  "shows preserved terms, fee uncertainty and comparison in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await Detail({
        params: Promise.resolve({ id: review.id }),
        searchParams: Promise.resolve({ organizationId: "org_a" }),
      }),
    );
    const c = planReviewsCopy(locale);
    expect(html).toContain(c.saved);
    expect(html).toContain(c.changed);
    expect(html).toContain(c.notice);
    expect(html).toContain(c.baseline);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>Plan");
    expect(html).toContain(`/api/subscriptions/reviews/${review.id}/export?organizationId=org_a`);
    expect(state.detail).toHaveBeenCalledWith(state.actor, review.id, "org_a");
  },
);
it("withdrawn terms remain visible and cannot masquerade as an active plan", async () => {
  state.detail.mockResolvedValue({ review, observedAt: date, state: "unavailable", current: null });
  const html = renderToStaticMarkup(
    await Detail({ params: Promise.resolve({ id: review.id }), searchParams: Promise.resolve({}) }),
  );
  expect(html).toContain(planReviewsCopy("en").unavailable);
  expect(html).not.toContain("/reviews/new?");
  expect(html).toContain("does not reserve a price");
});
it("history preserves organization, periods and scope pagination", async () => {
  state.page.mockResolvedValue({
    scope: { id: "org:org_a", name: "My organization" },
    reviews: [review],
    page: 2,
    pageSize: 20,
    total: 21,
    totalPages: 3,
  });
  const html = renderToStaticMarkup(
    await History({
      searchParams: Promise.resolve({ organizationId: "org_a", days: "30", page: "2" }),
    }),
  );
  expect(html).toContain("organizationId=org_a");
  expect(html).toContain("days=30");
  expect(html).toContain("scopePage=2");
  expect(html).toContain(`/reviews/${review.id}?organizationId=org_a`);
  expect(state.page).toHaveBeenCalledWith(
    state.actor,
    expect.objectContaining({ organizationId: "org_a", days: 30, page: 2 }),
  );
});
it("refuses stale catalog revision before constructing a save form", async () => {
  const html = renderToStaticMarkup(
    await New({ searchParams: Promise.resolve({ planId: "cplan_a", revision: "1" }) }),
  );
  expect(html).toContain(planReviewsCopy("en").planChanged);
  expect(html).not.toContain("/api/subscriptions");
  expect(state.scopes).not.toHaveBeenCalled();
});
it.each(["user", "organization"])(
  "builds the %s selection with live authorized organization choices",
  async (scope) => {
    state.plan.mockResolvedValue({
      id: "cplan_a",
      slug: "plan",
      scope,
      revision: 2,
      status: "published",
      updatedAt: date,
      ...terms,
    });
    const html = renderToStaticMarkup(
      await New({
        searchParams: Promise.resolve({ planId: "cplan_a", revision: "2", scopePage: "2" }),
      }),
    );
    expect(html).toContain("Save review");
    expect(html).toContain("Example sale amount");
    expect(html).toContain("does not reserve a price");
    if (scope === "organization") expect(html).toContain("My organization");
    else expect(html).not.toContain('value="org_a"');
    expect(state.scopes).toHaveBeenCalledWith(state.actor, 2);
  },
);
it("malformed query arrays show recovery without requesting private details", async () => {
  const html = renderToStaticMarkup(
    await Detail({
      params: Promise.resolve({ id: review.id }),
      searchParams: Promise.resolve({ organizationId: ["org_a", "org_b"] }),
    }),
  );
  expect(html).toContain(planReviewsCopy("en").invalid);
  expect(state.detail).not.toHaveBeenCalled();
});
it("masks absent or unauthorized details", async () => {
  state.detail.mockRejectedValue(new AppError("Private selection", 404, "NOT_FOUND"));
  await expect(
    Detail({ params: Promise.resolve({ id: review.id }), searchParams: Promise.resolve({}) }),
  ).rejects.toThrow("NOT_FOUND");
});
