import { describe, expect, it } from "vitest";
import {
  createSupportCaseSchema,
  createSupportMessageSchema,
  updateSupportCaseStatusSchema,
  supportStaffQueueFiltersSchema,
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
      createSupportMessageSchema.safeParse({ message: "Thanks", expectedStatus: "open" }).success,
    ).toBe(true);
    expect(
      createSupportMessageSchema.safeParse({ message: "Follow up", expectedStatus: "resolved" }).success,
    ).toBe(true);
    expect(
      createSupportMessageSchema.safeParse({ message: "Thanks" }).success,
    ).toBe(false);
    expect(
      createSupportMessageSchema.safeParse({ message: "", expectedStatus: "open" }).success,
    ).toBe(false);
    expect(
      createSupportMessageSchema.safeParse({ message: "Thanks", expectedStatus: "unknown" }).success,
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

describe("support staff queue filters", () => {
  it("only accepts recognized filters without extra fields", () => {
    expect(supportStaffQueueFiltersSchema.safeParse({}).success).toBe(true);
    expect(supportStaffQueueFiltersSchema.safeParse({ status: "open", category: "payment" }).success).toBe(true);
    expect(supportStaffQueueFiltersSchema.safeParse({ status: "pending" }).success).toBe(false);
    expect(supportStaffQueueFiltersSchema.safeParse({ category: "" }).success).toBe(false);
    expect(supportStaffQueueFiltersSchema.safeParse({ category: "payment", requesterId: "usr_victim" }).success).toBe(false);
  });
});
