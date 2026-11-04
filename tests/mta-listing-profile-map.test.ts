import { describe, expect, it } from "vitest";
import {
  mtaEndpointKey,
  mtaListingProfileRecord,
} from "../apps/web/src/lib/mta-listing-profile-map";

describe("mta listing profile map", () => {
  it("normalizes addresses when building endpoint keys and slug records", () => {
    expect(mtaEndpointKey("  Play.Example.COM. ", 22003)).toBe("play.example.com:22003");
    expect(
      mtaListingProfileRecord([
        { ipAddress: "203.0.113.10", port: 22003, slug: "alpha" },
        { ipAddress: "Play.Example.COM", port: 22003, slug: "beta" },
      ]),
    ).toEqual({
      "203.0.113.10:22003": "alpha",
      "play.example.com:22003": "beta",
    });
  });
});
