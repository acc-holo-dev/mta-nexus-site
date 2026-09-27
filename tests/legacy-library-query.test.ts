import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const captured = vi.hoisted(() => ({ selection: null as Record<string, unknown> | null, filter: null as SQL | null }));
vi.mock("../packages/db/src/client", () => ({
  db: {
    select(selection: Record<string, unknown>) {
      captured.selection = selection;
      return { from: () => ({ where: (filter: SQL) => {
        captured.filter = filter;
        return Promise.resolve([]);
      } }) };
    },
  },
}));

import { LicenseRepository } from "../packages/db/src/repositories/licenses";

describe("private legacy library lookup", () => {
  it("selects only product/date for the current user's active unexpired licenses", async () => {
    await new LicenseRepository().listActiveDownloadableByUser("member-1");
    expect(Object.keys(captured.selection ?? {})).toEqual(["productId", "createdAt"]);
    const query = new PgDialect().sqlToQuery(captured.filter!);
    expect(query.params).toContain("member-1");
    expect(query.params).toContain("active");
    expect(query.sql).toContain('"licenses"."expires_at" is null');
    expect(query.sql).toContain('"licenses"."expires_at" >');
  });
});
