import { expect, it } from "vitest";
import { createServerSchema, updateServerSchema } from "@nexus/validation";

it("keeps all missing registration fields absent from an empty or description-only edit", () => {
  expect(updateServerSchema.parse({})).toEqual({});
  expect(updateServerSchema.parse({ description: "Revised description" })).toEqual({
    description: "Revised description",
  });
});

it.each([
  { mediaUrls: [] },
  { gameplayTags: [] },
  { port: 41000 },
  { httpPort: 41001 },
  { maxPlayers: 32 },
  { visibility: "private" },
])("preserves explicitly supplied defaults-capable fields: %j", (input) => {
  expect(updateServerSchema.parse(input)).toEqual(input);
});

it("continues applying defaults when registering a new server", () => {
  expect(
    createServerSchema.parse({
      name: "New Server",
      slug: "new-server",
      ipAddress: " PLAY.Example.COM. ",
    }),
  ).toMatchObject({
    ipAddress: "play.example.com",
    mediaUrls: [],
    gameplayTags: [],
    port: 22003,
    httpPort: 22005,
    maxPlayers: 128,
    visibility: "public",
  });
});
