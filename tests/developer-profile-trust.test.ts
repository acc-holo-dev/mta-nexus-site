import * as React from "react";
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

const listDevelopers = vi.hoisted(() =>
  vi.fn(async () => state.developers),
);

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { listDevelopers },
}));

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
  }) => <span aria-label={alt}>{fallback}</span>,
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
    const html = renderToStaticMarkup(await DevelopersPage());
    const copy = getDictionary("en").developers;

    expect(listDevelopers).toHaveBeenCalledWith(100);
    expect(html).toContain('href="/developers/developer"');
    expect(html).toContain('href="/developers/admin-builder"');
    expect(html).toContain(copy.verifiedIdentity);
    expect(html).toContain(copy.creatorProfile);
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
