import { describe, expect, it } from "vitest";
import { ServerEndpointAuditCollector } from "@nexus/domain";

describe("read-only MTA endpoint audit", () => {
  it("detects canonical DNS and IPv6 aliases without merging identities", () => {
    const audit = new ServerEndpointAuditCollector();
    for (const row of [
      {
        id: "s1",
        ipAddress: "PLAY.Example.COM.",
        port: 22003,
        ownerId: "owner_a",
        isVerified: true,
      },
      { id: "s2", ipAddress: "play.example.com", port: 22003, ownerId: "owner_b" },
      { id: "s3", ipAddress: "play.example.com", port: 22004, ownerId: "owner_a" },
      { id: "s4", ipAddress: "fe80::abcd", port: 22003, organizationId: "team", isVerified: true },
      { id: "s5", ipAddress: "[fe80::abcd]", port: 22003, organizationId: "team" },
      { id: "s6", ipAddress: "invalid host", port: 22003 },
      { id: "s7", ipAddress: "valid.example", port: 0, ownerId: "owner_a", organizationId: "team" },
    ]) {
      audit.add(row);
    }
    const result = audit.result();
    expect(result.summary).toEqual({
      scanned: 7,
      invalidRows: 2,
      nonCanonicalRows: 2,
      mixedOwnershipRows: 1,
      unclaimedRows: 1,
      collisionGroups: 2,
      collidingRows: 4,
      collisionGroupsWithOwnershipConflict: 1,
      collisionGroupsWithVerifiedServers: 2,
    });
    expect(result.details.collisions.map((group) => group.serverIds)).toEqual([
      ["s4", "s5"],
      ["s1", "s2"],
    ]);
    expect(result.details.collisions.map((group) => group.ownerScopes)).toEqual([
      ["organization:team"],
      ["user:owner_a", "user:owner_b"],
    ]);
    expect(result.details.collisions.map((group) => group.ownershipConflict)).toEqual([
      false,
      true,
    ]);
    expect(result.details.collisions.map((group) => group.verifiedServerIds)).toEqual([
      ["s4"],
      ["s1"],
    ]);
    // Conflicts are reported for remediation, not silently reassigned.
    expect(result.details.invalidRows.map((row) => row.id)).toEqual(["s6", "s7"]);
  });

  it("detects expanded IPv6 aliases within one game port without changing owners", () => {
    const audit = new ServerEndpointAuditCollector();
    audit.add({
      id: "server_owner_a",
      ipAddress: "FE80:0:0:0:0:0:0:ABCD",
      port: 22003,
      ownerId: "owner_a",
      isVerified: true,
    });
    audit.add({
      id: "server_owner_b",
      ipAddress: "fe80::abcd",
      port: 22003,
      ownerId: "owner_b",
    });
    audit.add({
      id: "server_owner_c",
      ipAddress: "[fe80::abcd]",
      port: 22004,
      ownerId: "owner_c",
    });
    const result = audit.result();
    expect(result.summary).toMatchObject({
      scanned: 3,
      nonCanonicalRows: 2,
      collisionGroups: 1,
      collidingRows: 2,
      collisionGroupsWithOwnershipConflict: 1,
      collisionGroupsWithVerifiedServers: 1,
    });
    expect(result.details.collisions).toEqual([
      {
        canonicalAddress: "[fe80::abcd]",
        port: 22003,
        serverIds: ["server_owner_a", "server_owner_b"],
        ownerScopes: ["user:owner_a", "user:owner_b"],
        verifiedServerIds: ["server_owner_a"],
        ownershipConflict: true,
      },
    ]);
  });

  it("keeps distinct ports separate and reports a clean canonical collection", () => {
    const audit = new ServerEndpointAuditCollector();
    audit.add({ id: "a", ipAddress: "play.example.com", port: 22003 });
    audit.add({ id: "b", ipAddress: "play.example.com", port: 22004 });
    expect(audit.result().summary).toEqual({
      scanned: 2,
      invalidRows: 0,
      nonCanonicalRows: 0,
      mixedOwnershipRows: 0,
      unclaimedRows: 2,
      collisionGroups: 0,
      collidingRows: 0,
      collisionGroupsWithOwnershipConflict: 0,
      collisionGroupsWithVerifiedServers: 0,
    });
  });

  it("marks mixed ownership and unclaimed collision groups as manual review", () => {
    const audit = new ServerEndpointAuditCollector();
    audit.add({
      id: "owned",
      ipAddress: "PLAY.EXAMPLE.COM.",
      port: 22003,
      organizationId: "team_a",
      isVerified: false,
    });
    audit.add({
      id: "unclaimed",
      ipAddress: "play.example.com",
      port: 22003,
      ownerId: null,
      organizationId: null,
      isVerified: false,
    });
    expect(audit.result().summary).toMatchObject({
      unclaimedRows: 1,
      collisionGroupsWithOwnershipConflict: 1,
      collisionGroupsWithVerifiedServers: 0,
    });
    expect(audit.result().details.collisions[0]).toMatchObject({
      ownerScopes: ["organization:team_a", "unclaimed"],
      ownershipConflict: true,
      serverIds: ["owned", "unclaimed"],
    });
  });

  it("keeps exact counts without retaining private row details in summary mode", () => {
    const detailed = new ServerEndpointAuditCollector();
    const compact = new ServerEndpointAuditCollector(false);
    const rows = [
      {
        id: "first_private_id",
        ipAddress: "PLAY.Private.Example.",
        port: 22003,
        ownerId: "private_owner_a",
        isVerified: true,
      },
      {
        id: "second_private_id",
        ipAddress: "play.private.example",
        port: 22003,
        ownerId: "private_owner_b",
      },
      { id: "invalid_private_id", ipAddress: "invalid host", port: 22003 },
      { id: "orphan_private_id", ipAddress: "another.private.example", port: 22004 },
    ];
    for (const row of rows) {
      detailed.add(row);
      compact.add(row);
    }
    const detailedReport = detailed.result();
    const compactReport = compact.result();
    expect(compactReport.summary).toEqual(detailedReport.summary);
    expect(compactReport.details).toEqual({
      invalidRows: [],
      nonCanonicalRows: [],
      collisions: [],
    });
    const serialized = JSON.stringify(compactReport);
    for (const secret of [
      "first_private_id",
      "second_private_id",
      "private_owner_a",
      "private_owner_b",
      "invalid host",
      "play.private.example",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(compactReport.summary).toMatchObject({
      collisionGroups: 1,
      collisionGroupsWithOwnershipConflict: 1,
      collisionGroupsWithVerifiedServers: 1,
    });
  });

  it("counts a large paginated-equivalent input without detailed allocations", () => {
    const audit = new ServerEndpointAuditCollector(false);
    for (let id = 0; id < 3_000; id += 1) {
      audit.add({
        id: `srv_${id}`,
        ipAddress: `game-${id}.example.com`,
        port: 22003,
        ownerId: `user_${id}`,
      });
    }
    audit.add({
      id: "duplicate",
      ipAddress: "GAME-0.EXAMPLE.COM.",
      port: 22003,
      ownerId: "different_owner",
    });
    expect(audit.result().summary).toMatchObject({
      scanned: 3_001,
      collisionGroups: 1,
      collidingRows: 2,
      collisionGroupsWithOwnershipConflict: 1,
    });
    expect(audit.result().details.collisions).toEqual([]);
  });

  it("does not claim a malformed address is a duplicate of a valid endpoint", () => {
    const audit = new ServerEndpointAuditCollector();
    audit.add({ id: "bad", ipAddress: "play.example..", port: 22003 });
    audit.add({ id: "good", ipAddress: "play.example", port: 22003 });
    expect(audit.result().summary).toMatchObject({
      invalidRows: 1,
      collisionGroups: 0,
    });
  });
});
