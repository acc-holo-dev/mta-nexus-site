import { expect, it } from "vitest";
import { buildFollowInitialState } from "./follow-initial-state";

it("hydrates guests as anonymous with known unmute", () => {
  expect(
    buildFollowInitialState({
      actor: null,
      targetId: "tgt",
      followedIds: [],
      mute: null,
    }),
  ).toEqual({
    authenticated: false,
    actorId: null,
    following: false,
    muted: false,
    mutedUntil: null,
  });
});

it("marks follow lookup failure without inventing mute hydration", () => {
  expect(
    buildFollowInitialState({
      actor: { id: "viewer" },
      targetId: "tgt",
      followedIds: null,
      mute: null,
    }),
  ).toEqual({
    authenticated: true,
    actorId: "viewer",
    following: false,
    error: true,
  });
});

it("hydrates following and mute for an authenticated viewer", () => {
  expect(
    buildFollowInitialState({
      actor: { id: "viewer" },
      targetId: "tgt",
      followedIds: ["tgt"],
      mute: { muted: true, mutedUntil: "2026-12-01T00:00:00.000Z" },
      self: false,
    }),
  ).toEqual({
    authenticated: true,
    actorId: "viewer",
    following: true,
    error: false,
    muted: true,
    mutedUntil: "2026-12-01T00:00:00.000Z",
  });
});
