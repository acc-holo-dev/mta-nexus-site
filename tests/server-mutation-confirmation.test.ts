import { describe, expect, it } from "vitest";
import {
  confirmedCreatedServer,
  confirmedUpdatedServer,
} from "../apps/web/src/lib/server-mutation-confirmation";

describe("server mutation confirmation", () => {
  it("confirms only a 201 creation for the requested slug", () => {
    expect(
      confirmedCreatedServer(
        201,
        { server: { id: "srv_1", slug: "my-server" } },
        "my-server",
      ),
    ).toBe("srv_1");

    for (const [status, body] of [
      [200, { server: { id: "srv_1", slug: "my-server" } }],
      [201, { server: { id: "", slug: "my-server" } }],
      [201, { server: { id: "srv_1", slug: "other" } }],
      [201, { success: true }],
    ] as const) {
      expect(
        confirmedCreatedServer(status, body, "my-server"),
      ).toBeNull();
    }
  });

  it("confirms the requested ownership scope after creating a server", () => {
    const personal = { server: { id: "srv_personal", slug: "personal", ownerId: "usr_1", organizationId: null } };
    expect(confirmedCreatedServer(201, personal, "personal", null)).toBe("srv_personal");
    expect(confirmedCreatedServer(201, { server: { ...personal.server, organizationId: "org_1" } }, "personal", null)).toBeNull();
    const organization = { server: { id: "srv_team", slug: "team", organizationId: "org_1" } };
    expect(confirmedCreatedServer(201, organization, "team", "org_1")).toBe("srv_team");
    expect(confirmedCreatedServer(201, organization, "team", "org_2")).toBeNull();
    expect(confirmedCreatedServer(201, personal, "personal", "org_1")).toBeNull();
  });

  it("verifies every editable field, complete arrays and the new revision", () => {
    const fields = {
      id: "srv_1", name: "Nexus Server", ipAddress: "play.example.com",
      port: 22003, httpPort: 22005, mapName: "Los Santos",
      visibility: "public", description: "Description",
      websiteUrl: "https://example.com", discordUrl: "", rulesUrl: "",
      mediaUrls: ["https://example.com/1.png", "https://example.com/2.png"],
      gameplayTags: ["racing", "rp"], language: "en",
      region: "EU", gameMode: "race", maxPlayers: 64,
      expectedUpdatedAt: "2026-10-10T01:00:00.000Z",
    };
    const { expectedUpdatedAt, ...stored } = fields;
    expect(confirmedUpdatedServer(200, {
      server: { ...stored, updatedAt: "2026-10-10T01:00:00.001Z" },
    }, fields)).toBe(true);
    for (const [field, value] of [
      ["mediaUrls", ["https://example.com/1.png"]],
      ["gameplayTags", ["rp", "racing"]],
      ["description", "other"],
      ["language", "ru"],
      ["maxPlayers", 32],
    ] as const) {
      expect(confirmedUpdatedServer(200, {
        server: { ...stored, [field]: value, updatedAt: "2026-10-10T01:00:00.001Z" },
      }, fields)).toBe(false);
    }
    expect(confirmedUpdatedServer(200, {
      server: { ...stored, updatedAt: expectedUpdatedAt },
    }, fields)).toBe(false);
    expect(confirmedUpdatedServer(200, { server: { ...stored } }, fields)).toBe(false);
  });

  it("confirms an update only when the returned authoritative core matches", () => {
    const expected = {
      id: "srv_1",
      name: "Nexus Server",
      ipAddress: "play.example.com",
      port: 22003,
      visibility: "public",
    };

    expect(
      confirmedUpdatedServer(
        200,
        { server: { ...expected, description: "Updated" } },
        expected,
      ),
    ).toBe(true);

    const extended = { ...expected, httpPort: 22006, mapName: "Los Santos" };
    expect(confirmedUpdatedServer(200, { server: extended }, extended)).toBe(true);
    expect(
      confirmedUpdatedServer(200, { server: { ...extended, httpPort: 22005 } }, extended),
    ).toBe(false);
    expect(
      confirmedUpdatedServer(200, { server: { ...extended, mapName: "Old map" } }, extended),
    ).toBe(false);
    expect(confirmedUpdatedServer(200, { server: expected }, extended)).toBe(false);

    for (const [status, body] of [
      [204, { server: expected }],
      [200, { server: { ...expected, id: "srv_2" } }],
      [200, { server: { ...expected, name: "Other" } }],
      [200, { server: { ...expected, port: 22004 } }],
      [200, { server: { ...expected, visibility: "private" } }],
      [200, { success: true }],
    ] as const) {
      expect(
        confirmedUpdatedServer(status, body, expected),
      ).toBe(false);
    }
  });
});
