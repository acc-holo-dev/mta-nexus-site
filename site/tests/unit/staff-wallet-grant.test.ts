import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AppError,
  buildStaffBalanceGrantPosting,
  LEDGER_REFERENCE_TYPES,
  STAFF_GRANT_CLEARING_ACCOUNT,
} from "@nexus/domain";
import { describe, expect, it } from "vitest";
import { confirmedStaffWalletGrant } from "../../src/features/commerce/wallet-staff-grant-confirmation";

const grantId = `wgr_${"a".repeat(24)}`;
const base = {
  grantId,
  accountId: "user:usr_member",
  amount: 1500,
  currency: "RUB" as const,
  reason: "Beta support credit",
  actorId: "usr_admin",
  userEntryId: `wgrc_${"a".repeat(24)}`,
  clearingEntryId: `wgrd_${"a".repeat(24)}`,
};

describe("staff wallet grant posting", () => {
  it("credits the member and debits the staff-grant clearing account", () => {
    const entries = buildStaffBalanceGrantPosting(base);
    expect(entries.map((entry) => entry.amount)).toEqual([1500, -1500]);
    expect(entries[0]).toMatchObject({
      accountId: "user:usr_member",
      referenceType: "staff_grant",
      referenceId: grantId,
    });
    expect(entries[1]?.accountId).toBe(STAFF_GRANT_CLEARING_ACCOUNT);
    expect(entries[0]?.description).toContain("usr_admin");
    expect(entries[0]?.description).toContain("Beta support credit");
    expect(entries.every((entry) => entry.referenceType !== "topup")).toBe(true);
  });

  it("rejects a short reason", () => {
    expect(() => buildStaffBalanceGrantPosting({ ...base, reason: "short" })).toThrow(AppError);
    try {
      buildStaffBalanceGrantPosting({ ...base, reason: "short" });
    } catch (error) {
      expect(error).toMatchObject({ code: "WALLET_GRANT_REASON_INVALID" });
    }
  });

  it("is named in the domain allowlist and the journal insert guard", () => {
    expect(LEDGER_REFERENCE_TYPES).toContain("staff_grant");
    const sql = readFileSync(
      resolve(process.cwd(), "site/packages/db/migrations/0095_ledger_staff_grant.sql"),
      "utf8",
    );
    expect(sql).toContain("'staff_grant'");
    expect(sql).toContain("ledger_balance_insert_guard");
  });
});

describe("confirmed staff wallet grant", () => {
  it("accepts the posted grant for the same admin", () => {
    expect(
      confirmedStaffWalletGrant(
        {
          actorId: "usr_admin",
          grantId,
          username: "member",
          accountId: "user:usr_member",
          amount: 1500,
          currency: "RUB",
          available: 1500,
        },
        "usr_admin",
      ),
    ).toEqual({
      grantId,
      username: "member",
      accountId: "user:usr_member",
      amount: 1500,
      currency: "RUB",
      available: 1500,
    });
  });

  it("rejects a grant confirmed for a different actor", () => {
    expect(
      confirmedStaffWalletGrant(
        {
          actorId: "usr_other",
          grantId,
          username: "member",
          accountId: "user:usr_member",
          amount: 1500,
          currency: "RUB",
          available: 1500,
        },
        "usr_admin",
      ),
    ).toBeNull();
  });
});
