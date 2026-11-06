import { sql } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import {
  createServerStatisticsPersistenceDbMock,
  fixture,
} from "./helpers/server-statistics-persistence-harness";

vi.mock("../packages/db/src/client", async (importOriginal) =>
  createServerStatisticsPersistenceDbMock(importOriginal),
);

import { ServerObservationRepository } from "../packages/db/src/repositories/server-observations";

it("checks persisted public visibility, current organization grants and live administrator roles", async () => {
  await fixture(async (tx) => {
    const repository = new ServerObservationRepository();
    expect(await repository.readStatistics({ id: "personal" }, { kind: "public" }, 24)).toBeNull();
    expect(
      await repository.readStatistics(
        { id: "personal" },
        { kind: "managed", actorId: "delegate" },
        24,
      ),
    ).toBeNull();
    expect(
      await repository.readStatistics(
        { id: "personal" },
        { kind: "managed", actorId: "owner" },
        24,
      ),
    ).not.toBeNull();
    expect(
      await repository.readStatistics({ id: "team" }, { kind: "managed", actorId: "delegate" }, 24),
    ).not.toBeNull();
    await tx.execute(
      sql`UPDATE organization_members SET permissions = '[]'::jsonb WHERE id = 'member'`,
    );
    // A legacy personal-owner column must not bypass the organization boundary.
    expect(
      await repository.readStatistics({ id: "team" }, { kind: "managed", actorId: "delegate" }, 24),
    ).toBeNull();
    expect(
      await repository.readStatistics({ id: "team" }, { kind: "managed", actorId: "owner" }, 24),
    ).not.toBeNull();
    expect(
      await repository.readStatistics(
        { id: "personal" },
        { kind: "managed", actorId: "admin" },
        24,
      ),
    ).not.toBeNull();
    await tx.execute(sql`UPDATE users SET role = 'user' WHERE id = 'admin'`);
    expect(
      await repository.readStatistics(
        { id: "personal" },
        { kind: "managed", actorId: "admin" },
        24,
      ),
    ).toBeNull();
    await tx.execute(sql`UPDATE servers SET visibility = 'unlisted' WHERE id = 'personal'`);
    expect(
      await repository.readStatistics({ slug: "personal" }, { kind: "public" }, 24),
    ).not.toBeNull();
  });
}, 30_000);

it("rechecks current grants and binds observation continuations to account, target and period", async () => {
  await fixture(async (tx, end) => {
    await tx.execute(sql`INSERT INTO server_observations (id,server_id,source,observed_at)
      SELECT 'private_'||lpad(n::text,3,'0'),'team','mta_master',${end.toISOString()}::timestamptz-interval '1 hour' FROM generate_series(1,26) n`);
    const repository = new ServerObservationRepository(),
      filters = {
        end,
        query: "",
        players: "all" as const,
        password: "all" as const,
        responding: "all" as const,
      };
    expect(
      await repository.pageObservations({ id: "team" }, { kind: "public" }, 24, filters),
    ).toBeNull();
    const first = await repository.pageObservations(
      { id: "team" },
      { kind: "managed", actorId: "delegate" },
      24,
      filters,
    );
    if (!first?.nextCursor) throw Error("Expected continuation");
    const cursor = { ...first.nextCursor, context: first.context, direction: "older" as const };
    await expect(
      repository.pageObservations({ id: "team" }, { kind: "managed", actorId: "owner" }, 24, {
        ...filters,
        cursor,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    await expect(
      repository.pageObservations({ id: "team" }, { kind: "managed", actorId: "delegate" }, 168, {
        ...filters,
        cursor,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    const ownerPage = await repository.pageObservations(
      { id: "team" },
      { kind: "managed", actorId: "owner" },
      24,
      filters,
    );
    if (!ownerPage?.nextCursor) throw Error("Expected owner continuation");
    await expect(
      repository.pageObservations({ id: "public" }, { kind: "managed", actorId: "owner" }, 24, {
        ...filters,
        cursor: { ...ownerPage.nextCursor, context: ownerPage.context, direction: "older" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    await tx.execute(
      sql`UPDATE organization_members SET permissions='[]'::jsonb WHERE id='member'`,
    );
    expect(
      await repository.pageObservations(
        { id: "team" },
        { kind: "managed", actorId: "delegate" },
        24,
        { ...filters, cursor },
      ),
    ).toBeNull();
    expect(
      await repository.pageObservations(
        { id: "team" },
        { kind: "managed", actorId: "admin" },
        24,
        filters,
      ),
    ).not.toBeNull();
    await tx.execute(sql`UPDATE users SET role='user' WHERE id='admin'`);
    expect(
      await repository.pageObservations(
        { id: "team" },
        { kind: "managed", actorId: "admin" },
        24,
        filters,
      ),
    ).toBeNull();
    await tx.execute(sql`UPDATE servers SET visibility='public' WHERE id='team'`);
    expect(
      await repository.pageObservations({ id: "team" }, { kind: "public" }, 24, filters),
    ).not.toBeNull();
    await tx.execute(sql`UPDATE servers SET visibility='private' WHERE id='team'`);
    expect(
      await repository.pageObservations({ id: "team" }, { kind: "public" }, 24, filters),
    ).toBeNull();
  });
}, 30_000);
