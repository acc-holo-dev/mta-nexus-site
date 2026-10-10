import type * as React from "react";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

const state = vi.hoisted(() => ({
  developers: [] as Array<Record<string, unknown>>,
  queryCondition: null as unknown,
  queryLimit: 0,
}));

const directoryPage = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService: { getSession: async () => null } }));
vi.mock("../apps/web/src/components/follow-button", () => ({ FollowButton: () => null }));
vi.mock("../apps/web/src/lib/services/discovery-service", () => ({
  discoveryService: { page: directoryPage },
}));
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({ indexMtaObservations: () => () => null }));

vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: React.ReactNode;
    }) => ReactModule.createElement("a", { href, ...props }, children),
  };
});

vi.mock("@nexus/ui", () => ({
  Avatar: ({
    alt,
    fallback,
  }: {
    alt: string;
    fallback: string;
  }) => <span role="img" aria-label={alt}>{fallback}</span>,
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
}));

vi.mock("../packages/db/src/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (condition: SQL) => {
          state.queryCondition = condition;
          return {
            limit: async (limit: number) => {
              state.queryLimit = limit;
              return [
                {
                  id: "usr_dev",
                  email: "developer@nexus.test",
                  username: "developer",
                  displayName: "Developer",
                  passwordHash: "must-not-leak",
                  role: "developer",
                  avatarUrl: null,
                  bio: null,
                  isVerified: true,
                  emailVerified: true,
                  twoFactorEnabled: false,
                  activeContextId: "personal",
                  createdAt: new Date("2026-01-01T00:00:00.000Z"),
                  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                },
              ];
            },
          };
        },
      }),
    }),
  },
}));

vi.mock("../apps/web/src/components/product-card", () => ({ ProductCard: () => null }));
vi.mock("../apps/web/src/components/server-card", () => ({ ServerCard: () => null }));
vi.mock("../apps/web/src/components/article-card", () => ({ ArticleCard: () => null }));

import DevelopersPage from "../apps/web/src/app/developers/page";
import { UserRepository } from "../packages/db/src/repositories/users";

describe("creator directory trust behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.queryCondition = null;
    state.queryLimit = 0;
    state.developers = [
      {
        id: "usr_dev",
        username: "developer",
        displayName: "Developer",
        avatarUrl: null,
        bio: "Builds MTA resources.",
        role: "developer",
        isVerified: true,
      },
      {
        id: "usr_admin",
        username: "admin-builder",
        displayName: "Admin Builder",
        avatarUrl: null,
        bio: "",
        role: "admin",
        isVerified: false,
      },
    ];
  });

  it("renders a bounded directory with honest identity labels", async () => {
    directoryPage.mockResolvedValue({ type: "creators", items: state.developers, page: 1, hasMore: false });
    const html = renderToStaticMarkup(await DevelopersPage());
    const copy = getDictionary("en").discover;

    expect(directoryPage).toHaveBeenCalledWith(expect.objectContaining({ type: "creators", page: 1 }));
    expect(html).toContain('href="/developers/developer"');
    expect(html).toContain('href="/developers/admin-builder"');
    expect(html).toContain(copy.verified);
    expect(html).not.toMatch(/Verified Seller|Verified Developer/u);
  });

  it("filters directory reads to developer/admin roles and clamps the repository limit", async () => {
    const repository = new UserRepository();
    const result = await repository.listDevelopers(1_000);
    const dialect = new PgDialect();
    const query = dialect.sqlToQuery(state.queryCondition as SQL);

    expect(state.queryLimit).toBe(100);
    expect(query.params).toEqual(
      expect.arrayContaining(["developer", "admin"]),
    );
    expect(query.sql).toContain('"users"."role"');
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("passwordHash");
  });
});
