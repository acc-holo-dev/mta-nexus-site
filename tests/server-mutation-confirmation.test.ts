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
