import { describe, expect, it } from "vitest";
import {
  createSupportCaseSchema,
  createSupportMessageSchema,
  updateSupportCaseStatusSchema,
} from "@nexus/validation";

describe("support validation", () => {
  it("accepts bounded cases and rejects unverified related entity context", () => {
    expect(
      createSupportCaseSchema.safeParse({
        category: "account",
        subject: "Cannot access my account",
        message: "Recovery finishes but the session is not restored.",
      }).success,
    ).toBe(true);

    expect(
      createSupportCaseSchema.safeParse({
        category: "purchase",
        subject: "Order context must be verified",
        message: "A client must not attach an arbitrary purchase to a support case.",
        relatedType: "purchase",
        relatedId: "ord_someone_else",
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
      updateSupportCaseStatusSchema.safeParse({ status: "resolved", expectedStatus: "open" }).success,
    ).toBe(true);
    expect(
      updateSupportCaseStatusSchema.safeParse({ status: "resolved" }).success,
    ).toBe(false);
    expect(
      updateSupportCaseStatusSchema.safeParse({ status: "pending", expectedStatus: "open" }).success,
    ).toBe(false);
    expect(
      updateSupportCaseStatusSchema.safeParse({ status: "closed", expectedStatus: "pending" }).success,
    ).toBe(false);
  });
});
