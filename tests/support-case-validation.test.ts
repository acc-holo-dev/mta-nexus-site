import { describe, expect, it } from "vitest";
import {
  createSupportCaseSchema,
  createSupportMessageSchema,
  updateSupportCaseStatusSchema,
} from "@nexus/validation";

describe("support validation", () => {
  it("accepts bounded cases and requires related entity pairs", () => {
    expect(
      createSupportCaseSchema.safeParse({
        category: "account",
        subject: "Cannot access my account",
        message: "Recovery finishes but the session is not restored.",
      }).success,
    ).toBe(true);

    expect(
      createSupportCaseSchema.safeParse({
        category: "resource",
        subject: "Resource install problem",
        message: "The resource fails during installation after download.",
        relatedType: "product",
      }).success,
    ).toBe(false);

    expect(
      createSupportCaseSchema.safeParse({
        category: "other",
        subject: "tiny",
        message: "short",
      }).success,
    ).toBe(false);
  });

  it("bounds replies and staff status mutations", () => {
    expect(
      createSupportMessageSchema.safeParse({ message: "Thanks" }).success,
    ).toBe(true);
    expect(
      createSupportMessageSchema.safeParse({ message: "" }).success,
    ).toBe(false);
    expect(
      updateSupportCaseStatusSchema.safeParse({ status: "resolved" }).success,
    ).toBe(true);
    expect(
      updateSupportCaseStatusSchema.safeParse({ status: "pending" }).success,
    ).toBe(false);
  });
});
