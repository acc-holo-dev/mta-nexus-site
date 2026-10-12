import { expect, it } from "vitest";
import {
  discussionReplayDatabaseIdentity as identity,
  discussionReplayOptions as options,
} from "../apps/web/scripts/discussion-replay-options";

const from = "2026-10-12T00:00:00.000001Z",
  until = "2026-10-12T01:00:00.000002Z";
const args = ["/durable/replay.json", from, until];
const scope = { databaseName: "nexus", databaseOid: "123", commentsOid: "456", followsOid: "789" };
const url = "postgres://worker:PRIVATE_PASSWORD@db.example:5432/nexus";

it("preserves existing invocation and accepts explicit worker/adoption with or without budget", () => {
  expect(options(args)).toEqual({
    checkpointName: args[0],
    from,
    until,
    limit: 100,
    worker: false,
    adoptLegacy: false,
  });
  expect(options([...args, "50", "--worker", "--adopt-legacy"])).toMatchObject({
    limit: 50,
    worker: true,
    adoptLegacy: true,
  });
  expect(options([...args, "--adopt-legacy", "--worker"])).toMatchObject({
    limit: 100,
    worker: true,
    adoptLegacy: true,
  });
  expect(options([...args, "10000"])).toMatchObject({ limit: 10000 });
});
it.each(["0", "10001", "-1", "1.5", "NaN", "Infinity", "0x10", "1e2", "", " 10"])(
  "rejects ambiguous or invalid budget %s",
  (value) => expect(() => options([...args, value])).toThrow(),
);
it.each(
  [
    [],
    args.slice(0, 2),
    [args[0], until, from],
    [...args, "--worker", "--worker"],
    [...args, "--adopt-legacy", "--adopt-legacy"],
    [...args, "--force"],
    [...args, "10", "extra"],
    [...args, "--worker", "50"],
  ].map((value) => ({ value })),
)("rejects invalid windows, missing arguments and duplicate/unknown flags %#", ({ value }) =>
  expect(() => options(value)).toThrow(),
);
it("fingerprints endpoint and actual tables without retaining credentials or URL options", () => {
  const value = identity(url, scope);
  expect(value).toMatch(/^[a-f0-9]{64}$/);
  expect(value).not.toContain("PRIVATE_PASSWORD");
  expect(
    identity("postgresql://new_user:ROTATED_SECRET@DB.EXAMPLE/nexus?sslmode=require", scope),
  ).toBe(value);
  // Actual current_database and relation scope take precedence over the URL's path.
  expect(identity("postgres://db.example/alias", scope)).toBe(value);
});
it("changes scope when endpoint, actual database or either resolved relation changes", () => {
  const baseline = identity(url, scope);
  for (const next of [
    { ...scope, databaseName: "other" },
    { ...scope, databaseOid: "124" },
    { ...scope, commentsOid: "457" },
    { ...scope, followsOid: "790" },
  ])
    expect(identity(url, next)).not.toBe(baseline);
  expect(identity("postgres://other.example/nexus", scope)).not.toBe(baseline);
  expect(identity("postgres://db.example:5433/nexus", scope)).not.toBe(baseline);
});
it.each([null, "", "0", "-1", "1.5", "4294967296", 456])(
  "fails closed on missing or invalid relation OID %#",
  (commentsOid) => {
    expect(() => identity(url, { ...scope, commentsOid })).toThrow("scope");
  },
);
it("rejects invalid configuration without exposing connection values", () => {
  for (const endpoint of ["PRIVATE_PASSWORD", "https://worker:PRIVATE_PASSWORD@db.example"])
    expect(() => identity(endpoint, scope)).toThrow("Invalid replay database endpoint");
  expect(() => identity(url, { ...scope, databaseName: "" })).toThrow("scope");
});
