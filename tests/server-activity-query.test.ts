import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createServerActivityQueryDbMock } = await import(
    "./helpers/server-activity-query-harness"
  );
  return createServerActivityQueryDbMock();
});

import { AuditRepository } from "../packages/db/src/repositories/audit";
import {
  installServerActivityQueryHooks,
  serverActivityQueryActor as actor,
  serverActivityQueryEvent as event,
  serverActivityQueryState as state,
} from "./helpers/server-activity-query-harness";

installServerActivityQueryHooks();

const repository = new AuditRepository();

it("checks current management rights before reading any server audit rows in a consistent snapshot", async () => {
  const result = await repository.pageForManagedServer("server", actor);
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries).toHaveLength(2);
  const scope = state.queries[0];
  expect(scope.params.filter((value) => value === "actor")).toHaveLength(4);
  expect(scope.params).toEqual(
    expect.arrayContaining(["member", "developer", "admin", '["manage_servers"]']),
  );
  expect(scope.sql).toContain('"servers"."organization_id" is null');
  expect(scope.sql).toContain('"organizations"."id" = "servers"."organization_id"');
  expect(scope.sql).toContain('"organization_members"."organization_id" = "organizations"."id"');
  expect(result).toEqual({
    server: { id: "server", name: "Server" },
    events: [
      {
        id: "aud_2",
        action: "server.updated",
        actorId: "editor",
        actorType: "user",
        actorUsername: "editor",
        actorDisplayName: "Editor",
        fields: ["name"],
        createdAt: new Date("2026-10-10T10:00:00Z"),
      },
    ],
    nextCursor: null,
  });
});

it("does not read an audit for a missing, unauthorized or revoked server", async () => {
  state.results = [[]];
  expect(await repository.pageForManagedServer("server", actor)).toBeNull();
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].sql).not.toContain('from "audit_events"');
});

it("preserves the platform administrator override and does not invent a moderator override", async () => {
  await repository.pageForManagedServer("server", { id: "admin", role: "admin" });
  expect(state.queries[0].sql).toContain('"users"."role" =');
  expect(state.queries[0].params).toContain("admin");
  state.queries = [];
  state.results = [[["server", "Server"]], []];
  await repository.pageForManagedServer("server", { id: "moderator", role: "moderator" });
  expect(state.queries[0].sql).toContain("exists");
});

it("scopes allowed actions to this server and projects neither raw details nor credentials", async () => {
  await repository.pageForManagedServer("server", actor);
  const read = state.queries[1];
  expect(read.params).toEqual(
    expect.arrayContaining([
      "server",
      "server.created",
      "server.updated",
      "server.claim_challenge_issued",
    ]),
  );
  expect(read.sql).toContain('"audit_events"."target_type"');
  expect(read.sql).toContain('"audit_events"."target_id"');
  expect(read.sql).toContain("jsonb_typeof");
  expect(read.sql).toContain("jsonb_array_elements_text");
  expect(read.sql).toContain("with ordinality");
  for (const field of [
    "password_hash",
    "email",
    "ip_address",
    "user_agent",
    "token_digest",
    "notes",
  ])
    expect(read.sql).not.toContain(`"${field}"`);
  expect(read.sql).not.toContain('"audit_events"."details",');
  expect(read.params.at(-1)).toBe(21);
});

it("uses a server-scoped SQL anchor without converting a microsecond timestamp into a JS date", async () => {
  await repository.pageForManagedServer("server", actor, "aud_anchor");
  const read = state.queries[1];
  expect(read.sql).toContain('("audit_events"."created_at", "audit_events"."id") <');
  expect(read.sql).toContain(
    'select "server_activity_anchor"."created_at", "server_activity_anchor"."id"',
  );
  expect(read.sql).toContain('from "audit_events" as "server_activity_anchor"');
  expect(read.sql).toContain('"server_activity_anchor"."target_id"');
  expect(read.sql).toContain('"server_activity_anchor"."target_type" = \'server\'');
  expect(read.params).toContain("aud_anchor");
  expect(read.params.filter((value) => value === "server")).toHaveLength(3);
  expect(read.sql).not.toContain("offset");
  expect(read.sql).not.toContain("count(");
});

it("returns only a page and uses the final visible event as the cursor", async () => {
  state.results = [[["server", "Server"]], [event("aud_3"), event("aud_2"), event("aud_1")]];
  const page = await repository.pageForManagedServer("server", actor, undefined, 2);
  expect(page?.events.map((row) => row.id)).toEqual(["aud_3", "aud_2"]);
  expect(page?.nextCursor).toBe("aud_2");
  expect(state.queries[1].params.at(-1)).toBe(3);
});
