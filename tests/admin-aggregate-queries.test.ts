import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const captured = vi.hoisted(() => ({
  selections: [] as unknown[],
  filters: [] as SQL[],
}));

vi.mock("../packages/db/src/client", () => ({
  db: {
    select(selection: unknown) {
      captured.selections.push(selection);
      const query = {
        from: () => query,
        where(condition: SQL) {
          captured.filters.push(condition);
          return query;
        },
        // biome-ignore lint/suspicious/noThenProperty: The Drizzle count query mock must be awaitable.
        then: (resolve: (rows: { total: number }[]) => void) => resolve([{ total: 217 }]),
      };
      return query;
    },
  },
}));

import { UserRepository } from "../packages/db/src/repositories/users";
import { ServerRepository } from "../packages/db/src/repositories/servers";
import { ProductRepository } from "../packages/db/src/repositories/products";
import { ContentRepository } from "../packages/db/src/repositories/content";
import { ReportRepository } from "../packages/db/src/repositories/reports";

describe("admin aggregate metrics", () => {
  it("counts beyond listing caps using small scalar queries with the public safety gates", async () => {
    const results = await Promise.all([
      new UserRepository().countAll(),
      new ServerRepository().countActivePublic(),
      new ProductRepository().countPublishedFree(),
      new ContentRepository().countPublished(),
      new ReportRepository().countOpen(),
    ]);
    expect(results).toEqual([217, 217, 217, 217, 217]);
    expect(captured.selections).toHaveLength(5);
    const sql = captured.filters.map((filter) => new PgDialect().sqlToQuery(filter));
    expect(sql).toHaveLength(4);
    expect(sql[0]?.params).toContain("public");
    expect(sql[0]?.params).toContain("active");
    expect(sql[1]?.sql).toContain("exists (");
    expect(sql[1]?.params).toContain("published");
    expect(sql[2]?.params).toContain("published");
    expect(sql[3]?.params).toContain("open");
  });
});
