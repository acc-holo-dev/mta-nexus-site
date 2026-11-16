import { expect, it } from "vitest";
import {
  resourceQaAnswerSchema,
  resourceQaAskSchema,
  resourceQaFollowSchema,
  resourceQaResolveSchema,
} from "@nexus/validation";

it("accepts ask bodies without rating fields", () => {
  expect(resourceQaAskSchema.parse({ body: "How do I install this?" })).toEqual({
    body: "How do I install this?",
  });
  expect(
    resourceQaAskSchema.parse({ body: "Does v2 work on 1.6?", buildId: "bld_a" }),
  ).toMatchObject({ buildId: "bld_a" });
  expect(() => resourceQaAskSchema.parse({ body: "How do I install this?", rating: 5 })).toThrow();
});

it("requires optimistic revisions for answer, resolve, and follow", () => {
  expect(
    resourceQaAnswerSchema.parse({
      body: "Use the published notes.",
      expectedThreadRevision: 2,
    }),
  ).toMatchObject({ expectedThreadRevision: 2 });
  expect(
    resourceQaResolveSchema.parse({
      action: "resolve",
      answerId: "rqa_a",
      expectedRevision: 3,
    }),
  ).toMatchObject({ action: "resolve" });
  expect(resourceQaResolveSchema.parse({ action: "reopen", expectedRevision: 4 })).toMatchObject({
    action: "reopen",
  });
  expect(resourceQaFollowSchema.parse({ action: "unfollow", expectedRevision: 1 })).toMatchObject({
    action: "unfollow",
  });
  expect(() =>
    resourceQaAnswerSchema.parse({ body: "Use the published notes.", expectedThreadRevision: 0 }),
  ).toThrow();
});
