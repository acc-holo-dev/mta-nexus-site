import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  selects: [] as Array<{ table: string; rows: unknown[] }>,
}));

vi.mock("../../packages/db/src/client", () => {
  function makeSelect(rows: unknown[]) {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.from = self;
    chain.where = self;
    chain.innerJoin = self;
    // biome-ignore lint/suspicious/noThenProperty: The Drizzle selection mock must be awaitable.
    chain.then = (resolve: (value: unknown[]) => unknown) => Promise.resolve(resolve(rows));
    return chain;
  }
  return {
    db: {
      select: () => {
        const next = state.selects.shift();
        return makeSelect(next?.rows ?? []);
      },
    },
  };
});

import type { Report } from "@nexus/domain";
import { resolveAdminReportTargets } from "../../packages/db/src/repositories/admin-report-targets";

beforeEach(() => {
  state.selects = [];
});

it("builds market Q&A deep links and article/server/user previews", async () => {
  state.selects = [
    {
      table: "products",
      rows: [{ id: "prd_a", title: "HUD", slug: "hud" }],
    },
    {
      table: "servers",
      rows: [{ id: "srv_a", name: "RP City", slug: "rp-city" }],
    },
    {
      table: "content",
      rows: [{ id: "cnt_a", title: "Guide", slug: "guide" }],
    },
    {
      table: "comments",
      rows: [
        {
          id: "cmt_a",
          contentId: "cnt_a",
          text: "spam body",
          title: "Guide",
          slug: "guide",
        },
      ],
    },
    {
      table: "users",
      rows: [{ id: "usr_a", username: "alice", displayName: "Alice" }],
    },
    {
      table: "qa",
      rows: [
        {
          id: "rqa_1",
          body: "How do I install this?",
          status: "open",
          revision: 3,
          productId: "prd_a",
          title: "HUD",
          slug: "hud",
        },
      ],
    },
  ];

  const reports = [
    {
      id: "1",
      targetType: "product",
      targetId: "prd_a",
    },
    {
      id: "2",
      targetType: "server",
      targetId: "srv_a",
    },
    {
      id: "3",
      targetType: "content",
      targetId: "cnt_a",
    },
    {
      id: "4",
      targetType: "comment",
      targetId: "cmt_a",
    },
    {
      id: "5",
      targetType: "user",
      targetId: "usr_a",
    },
    {
      id: "6",
      targetType: "resource_qa_thread",
      targetId: "rqa_1",
    },
  ] as Report[];

  const map = await resolveAdminReportTargets(reports);
  expect(map.get("product:prd_a")).toEqual({
    title: "HUD",
    href: "/market/hud",
    detail: null,
  });
  expect(map.get("server:srv_a")).toEqual({
    title: "RP City",
    href: "/servers/rp-city",
    moderationHref: "/workspace/servers/srv_a",
    detail: null,
  });
  expect(map.get("content:cnt_a")).toEqual({
    title: "Guide",
    href: "/articles/guide",
    moderationHref: "/admin/community/cnt_a",
    detail: null,
  });
  expect(map.get("comment:cmt_a")).toEqual({
    title: "Guide",
    href: "/articles/guide",
    moderationHref: "/admin/community/cnt_a/discussion/cmt_a",
    detail: "spam body",
  });
  expect(map.get("user:usr_a")).toEqual({
    title: "Alice",
    href: "/users/alice",
    detail: "@alice",
  });
  expect(map.get("resource_qa_thread:rqa_1")).toEqual({
    title: "HUD",
    href: "/market/hud?qa=rqa_1#resource-qa",
    detail: "How do I install this?",
    productId: "prd_a",
    revision: 3,
    removable: true,
  });
});
