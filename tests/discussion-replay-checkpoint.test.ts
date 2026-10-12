import { expect, it } from "vitest";
import {
  parseDiscussionReplayCheckpoint as parse,
  replayTimestamp,
} from "../apps/web/src/lib/services/discussion-replay-checkpoint";

const from = "2026-10-12T00:00:00.000000Z",
  until = "2026-10-12T01:00:00.000000Z";
const checkpoint = { version: 1, from, until, cursor: null, completed: false };
const pending = {
  id: "comment_b",
  createdAt: until,
  contentId: "post",
  audienceCursor: { createdAt: from, id: "follow_50" },
};
it("reads legacy checkpoints and roundtrips page progress without losing microseconds", () => {
  expect(parse(checkpoint, from, until)).toEqual(checkpoint);
  const value = {
    ...checkpoint,
    cursor: { id: "comment_a", createdAt: "2026-10-12T00:30:00.000123Z" },
    pending,
  };
  expect(parse(JSON.parse(JSON.stringify(value)), from, until)).toEqual(value);
});
it.each([
  null,
  [],
  {},
  { ...checkpoint, version: 2 },
  { ...checkpoint, completed: "false" },
  { ...checkpoint, from: until },
  { ...checkpoint, cursor: { id: "x", createdAt: "2026-10-11T00:00:00.000000Z" } },
  { ...checkpoint, cursor: { id: "x\nprivate", createdAt: from } },
])("rejects invalid checkpoint %# before reuse", (value) => {
  expect(() => parse(value, from, until)).toThrow();
});
it.each([
  null,
  [],
  { ...pending, contentId: "" },
  { ...pending, audienceCursor: null },
  { ...pending, createdAt: "2026-10-12T02:00:00.000000Z" },
  { ...pending, audienceCursor: { id: "follow", createdAt: "2026-10-12T02:00:00.000000Z" } },
])("rejects malformed pending audience %#", (value) => {
  expect(() => parse({ ...checkpoint, pending: value }, from, until)).toThrow();
});
it("rejects pending state at or before a completed cursor and on a completed window", () => {
  expect(() => parse({ ...checkpoint, pending, completed: true }, from, until)).toThrow();
  expect(() =>
    parse(
      { ...checkpoint, pending, cursor: { id: pending.id, createdAt: pending.createdAt } },
      from,
      until,
    ),
  ).toThrow();
});
it.each([
  "2026-02-30T00:00:00.000000Z",
  "2026-10-12T24:00:00.000000Z",
  "2026-10-12T00:00:00.000Z",
  "2026-10-12T00:00:00.000000+00:00",
  undefined,
])("rejects noncanonical timestamp %s", (value) => expect(() => replayTimestamp(value)).toThrow());
it("preserves valid leap dates and six-digit fractions", () => {
  expect(replayTimestamp("2024-02-29T23:59:59.999999Z")).toBe("2024-02-29T23:59:59.999999Z");
});
